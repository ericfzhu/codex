#!/usr/bin/env python3
"""Build the Memetic Cloud from the embeddings already stored in /public.

The script never calls an embedding API. It:
1. loads the best existing vector source for each collection;
2. removes conservative text duplicates while preserving source IDs;
3. normalizes vectors and reduces them to a shared PCA semantic space;
4. benchmarks seeded PaCMAP and UMAP candidates;
5. projects the complete cleaned corpus with the winning candidate;
6. computes approximate nearest neighbours in semantic space; and
7. writes compact point/graph data separately from lazy text metadata.

Install the local tooling first:
    python3 -m pip install -r scripts/requirements-cloud.txt

Then run:
    python3 scripts/generate-cloud.py
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pacmap
import umap
from pynndescent import NNDescent
from scipy.stats import spearmanr
from sklearn.decomposition import PCA
from sklearn.manifold import trustworthiness
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
EMBEDDING_DIM = 1024
DEFAULT_SEED = 37495
NEIGHBOUR_COUNT = 8


@dataclass(frozen=True)
class CollectionSpec:
    slug: str
    label: str
    metadata_file: str
    float_file: str | None
    int8_files: tuple[str, ...]
    colour: str


COLLECTIONS = (
    CollectionSpec("quotes", "PHILOSOPHY", "quotes-cohere.json", "quotes-embeddings.bin", ("quotes-embeddings-int8.bin",), "#6d3db4"),
    CollectionSpec("christianity", "CHRISTIANITY", "bible-cohere.json", "bible-embeddings.bin", ("bible-embeddings-int8-0.bin", "bible-embeddings-int8-1.bin", "bible-embeddings-int8-2.bin"), "#d97706"),
    CollectionSpec("islam", "ISLAM", "islam-cohere.json", "islam-embeddings.bin", ("islam-embeddings-int8.bin",), "#047857"),
    CollectionSpec("mormonism", "MORMONISM", "mormon-cohere.json", "mormon-embeddings.bin", ("mormon-embeddings-int8.bin",), "#1d4ed8"),
    CollectionSpec("confucianism", "CONFUCIANISM", "confucian-cohere.json", "confucian-embeddings.bin", ("confucian-embeddings-int8.bin",), "#b91c1c"),
)


@dataclass
class CorpusItem:
    collection_index: int
    item_id: int
    row_index: int
    duplicate_count: int
    text: str
    author: str
    book: str
    source: str
    reference: str


@dataclass(frozen=True)
class Candidate:
    key: str
    family: str
    n_neighbors: int
    min_dist: float | None = None


CANDIDATES = (
    Candidate("pacmap-30", "pacmap", 30),
    Candidate("umap-30-015", "umap", 30, 0.15),
    Candidate("umap-50-025", "umap", 50, 0.25),
)


def log(message: str) -> None:
    print(message, flush=True)


def canonical_text(value: str) -> str:
    """Collapse only conservative formatting-level text differences."""
    value = unicodedata.normalize("NFKC", value).casefold()
    value = re.sub(r"[^\w\s]", " ", value, flags=re.UNICODE)
    return " ".join(value.split())


def get_text(metadata: dict[str, Any]) -> str:
    return str(metadata.get("text") or metadata.get("quote") or "").strip()


def get_reference(metadata: dict[str, Any]) -> str:
    chapter = str(metadata.get("chapter") or "").strip()
    verse = str(metadata.get("verse") or "").strip()
    if chapter and verse:
        return f"{chapter}:{verse}"
    return chapter or verse


def load_vector_file(spec: CollectionSpec, row_count: int) -> tuple[np.memmap | np.ndarray, str]:
    expected_float_bytes = row_count * EMBEDDING_DIM * np.dtype(np.float32).itemsize
    if spec.float_file:
        float_path = PUBLIC / spec.float_file
        if float_path.exists() and float_path.stat().st_size == expected_float_bytes:
            vectors = np.memmap(float_path, dtype=np.float32, mode="r", shape=(row_count, EMBEDDING_DIM))
            return vectors, f"float32:{spec.float_file}"

    chunks = [PUBLIC / name for name in spec.int8_files]
    missing = [str(path) for path in chunks if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing embedding file(s) for {spec.slug}: {', '.join(missing)}")
    raw = b"".join(path.read_bytes() for path in chunks)
    expected_int8_bytes = row_count * EMBEDDING_DIM
    if len(raw) != expected_int8_bytes:
        raise ValueError(f"{spec.slug} vectors contain {len(raw)} bytes; expected {expected_int8_bytes}")
    vectors = np.frombuffer(raw, dtype=np.int8).reshape(row_count, EMBEDDING_DIM)
    return vectors, f"int8:{'+'.join(spec.int8_files)}"


def load_corpus() -> tuple[list[CorpusItem], np.ndarray, dict[str, Any]]:
    items: list[CorpusItem] = []
    vector_blocks: list[np.ndarray] = []
    collection_report: list[dict[str, Any]] = []

    for collection_index, spec in enumerate(COLLECTIONS):
        metadata = json.loads((PUBLIC / spec.metadata_file).read_text())
        vectors, vector_source = load_vector_file(spec, len(metadata))
        first_by_text: dict[str, int] = {}
        duplicate_counts: Counter[int] = Counter()
        kept_rows: list[int] = []

        for row_index, row in enumerate(metadata):
            text = get_text(row)
            canonical = canonical_text(text)
            if not canonical:
                continue
            if canonical in first_by_text:
                duplicate_counts[first_by_text[canonical]] += 1
                continue
            first_by_text[canonical] = row_index
            kept_rows.append(row_index)

        block = np.asarray(vectors[kept_rows], dtype=np.float32)
        zero_vectors = np.flatnonzero(np.linalg.norm(block, axis=1) == 0)
        if zero_vectors.size:
            zero_set = set(zero_vectors.tolist())
            kept_rows = [row for position, row in enumerate(kept_rows) if position not in zero_set]
            block = np.delete(block, zero_vectors, axis=0)

        for row_index in kept_rows:
            row = metadata[row_index]
            items.append(
                CorpusItem(
                    collection_index=collection_index,
                    item_id=int(row.get("id", row_index)),
                    row_index=row_index,
                    duplicate_count=1 + duplicate_counts[row_index],
                    text=get_text(row),
                    author=str(row.get("author") or "").strip(),
                    book=str(row.get("book") or row.get("book_title") or "").strip(),
                    source=str(row.get("source") or "").strip(),
                    reference=get_reference(row),
                )
            )

        vector_blocks.append(block)
        collection_report.append(
            {
                "slug": spec.slug,
                "label": spec.label,
                "inputRows": len(metadata),
                "uniqueRows": len(kept_rows),
                "collapsedRows": len(metadata) - len(kept_rows),
                "vectorSource": vector_source,
            }
        )
        log(f"  {spec.label:<16} {len(metadata):>6,} rows → {len(kept_rows):>6,} points ({vector_source})")

    matrix = np.vstack(vector_blocks).astype(np.float32, copy=False)
    normalize(matrix, norm="l2", copy=False)
    return items, matrix, {"collections": collection_report}


def stratified_sample(items: list[CorpusItem], size: int, seed: int) -> np.ndarray:
    """Make small benchmark candidates equally legible without changing full-map density."""
    rng = np.random.default_rng(seed)
    groups = [np.array([i for i, item in enumerate(items) if item.collection_index == c], dtype=np.int32) for c in range(len(COLLECTIONS))]
    allocation = max(1, size // len(groups))
    selected: list[np.ndarray] = []
    remainder: list[np.ndarray] = []
    for group in groups:
        shuffled = rng.permutation(group)
        take = min(allocation, len(shuffled))
        selected.append(shuffled[:take])
        remainder.append(shuffled[take:])
    result = np.concatenate(selected)
    shortfall = min(size, len(items)) - len(result)
    if shortfall > 0:
        pool = np.concatenate(remainder)
        result = np.concatenate((result, rng.permutation(pool)[:shortfall]))
    return np.sort(result)


def approximate_knn(matrix: np.ndarray, count: int, seed: int, metric: str) -> np.ndarray:
    """Build deterministic approximate neighbours without PaCMAP's Annoy dependency."""
    index = NNDescent(
        matrix,
        n_neighbors=count + 1,
        metric=metric,
        n_trees=48,
        n_iters=12,
        max_candidates=60,
        low_memory=True,
        random_state=seed,
        n_jobs=-1,
        verbose=False,
    )
    indices, _ = index.neighbor_graph
    neighbours = np.empty((len(matrix), count), dtype=np.int32)
    for source, candidates in enumerate(indices):
        selected = [int(candidate) for candidate in candidates if candidate >= 0 and candidate != source][:count]
        if len(selected) < count:
            selected.extend([source] * (count - len(selected)))
        neighbours[source] = selected
    return neighbours


def project(
    matrix: np.ndarray,
    candidate: Candidate,
    seed: int,
    verbose: bool = False,
    return_neighbours: bool = False,
) -> tuple[np.ndarray, np.ndarray | None]:
    if candidate.family == "pacmap":
        neighbours = approximate_knn(matrix, candidate.n_neighbors, seed, "euclidean")
        pair_neighbors = np.column_stack(
            (
                np.repeat(np.arange(len(matrix), dtype=np.int32), candidate.n_neighbors),
                neighbours.reshape(-1),
            )
        ).astype(np.int32, copy=False)
        model = pacmap.PaCMAP(
            n_components=2,
            n_neighbors=candidate.n_neighbors,
            MN_ratio=0.5,
            FP_ratio=2.0,
            distance="euclidean",
            apply_pca=False,
            pair_neighbors=pair_neighbors,
            random_state=seed,
            verbose=verbose,
        )
        coords = np.asarray(model.fit_transform(matrix, init="pca"), dtype=np.float32)
        return coords, neighbours[:, :NEIGHBOUR_COUNT] if return_neighbours else None

    model = umap.UMAP(
        n_components=2,
        n_neighbors=candidate.n_neighbors,
        min_dist=float(candidate.min_dist),
        spread=1.0,
        metric="cosine",
        init="spectral",
        random_state=seed,
        n_jobs=1,
        low_memory=True,
        verbose=verbose,
    )
    return np.asarray(model.fit_transform(matrix), dtype=np.float32), None


def pair_sample(count: int, pair_count: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    left = rng.integers(0, count, size=pair_count)
    right = rng.integers(0, count, size=pair_count)
    valid = left != right
    return left[valid], right[valid]


def quality_metrics(matrix: np.ndarray, coords: np.ndarray, seed: int, evaluation_size: int = 2500) -> dict[str, float]:
    rng = np.random.default_rng(seed)
    eval_count = min(evaluation_size, len(matrix))
    indices = np.sort(rng.choice(len(matrix), size=eval_count, replace=False))
    high = matrix[indices]
    low = coords[indices]
    k = min(15, eval_count - 1)

    high_knn = NearestNeighbors(n_neighbors=k + 1, metric="cosine").fit(high).kneighbors(return_distance=False)[:, 1:]
    low_knn = NearestNeighbors(n_neighbors=k + 1, metric="euclidean").fit(low).kneighbors(return_distance=False)[:, 1:]
    recall = np.mean([len(set(a).intersection(b)) / k for a, b in zip(high_knn, low_knn)])

    left, right = pair_sample(eval_count, min(100_000, eval_count * 40), seed + 1)
    high_distance = 1.0 - np.einsum("ij,ij->i", high[left], high[right])
    low_distance = np.linalg.norm(low[left] - low[right], axis=1)
    correlation = float(spearmanr(high_distance, low_distance).statistic)

    return {
        "trustworthiness15": round(float(trustworthiness(high, low, n_neighbors=k, metric="cosine")), 6),
        "neighbourRecall15": round(float(recall), 6),
        "globalDistanceSpearman": round(correlation, 6),
    }


def candidate_score(metrics: dict[str, float]) -> float:
    return 0.5 * metrics["trustworthiness15"] + 0.3 * metrics["neighbourRecall15"] + 0.2 * max(0.0, metrics["globalDistanceSpearman"])


def benchmark(matrix: np.ndarray, items: list[CorpusItem], size: int, seed: int) -> tuple[Candidate, list[dict[str, Any]]]:
    sample_indices = stratified_sample(items, min(size, len(items)), seed)
    sample = matrix[sample_indices]
    results: list[dict[str, Any]] = []
    log(f"\nBenchmarking {len(CANDIDATES)} projections on {len(sample):,} stratified points…")
    for candidate in CANDIDATES:
        started = time.time()
        log(f"  {candidate.key}: projecting")
        coords, _ = project(sample, candidate, seed)
        metrics = quality_metrics(sample, coords, seed)
        score = candidate_score(metrics)
        result = {
            "key": candidate.key,
            "family": candidate.family,
            "nNeighbors": candidate.n_neighbors,
            "minDist": candidate.min_dist,
            "sampleSize": len(sample),
            "score": round(score, 6),
            "durationSeconds": round(time.time() - started, 2),
            **metrics,
        }
        results.append(result)
        log(f"    score {score:.4f} · trust {metrics['trustworthiness15']:.4f} · recall {metrics['neighbourRecall15']:.4f} · global {metrics['globalDistanceSpearman']:.4f}")

    winner_result = max(results, key=lambda result: (result["score"], result["globalDistanceSpearman"]))
    winner = next(candidate for candidate in CANDIDATES if candidate.key == winner_result["key"])
    log(f"  winner: {winner.key}")

    log(f"  {winner.key}: checking second-seed stability")
    first, _ = project(sample, winner, seed)
    second, _ = project(sample, winner, seed + 1)
    left, right = pair_sample(len(sample), min(100_000, len(sample) * 20), seed + 2)
    first_distance = np.linalg.norm(first[left] - first[right], axis=1)
    second_distance = np.linalg.norm(second[left] - second[right], axis=1)
    winner_result["secondSeedDistanceSpearman"] = round(float(spearmanr(first_distance, second_distance).statistic), 6)
    return winner, results


def semantic_neighbours(
    matrix: np.ndarray,
    count: int,
    seed: int,
    cached: np.ndarray | None = None,
) -> tuple[np.ndarray, dict[str, float]]:
    log(f"\nBuilding semantic neighbour index ({len(matrix):,} points, {matrix.shape[1]} dimensions)…")
    neighbours = cached if cached is not None else approximate_knn(matrix, count, seed, "cosine")

    rng = np.random.default_rng(seed)
    validation_indices = np.sort(rng.choice(len(matrix), size=min(400, len(matrix)), replace=False))
    recalls = []
    for source in validation_indices:
        scores = matrix @ matrix[source]
        exact = np.argpartition(scores, -(count + 1))[-(count + 1):]
        exact = set(int(i) for i in exact if i != source)
        recalls.append(len(exact.intersection(neighbours[source])) / count)
    report = {
        "semanticNeighbourCount": count,
        "index": "PyNNDescent cosine on normalized PCA space",
        "nTrees": 48,
        "nIters": 12,
        "annRecallAt8": round(float(np.mean(recalls)), 6),
    }
    log(f"  approximate-neighbour recall@{count}: {report['annRecallAt8']:.4f}")
    return neighbours, report


def normalize_coordinates(coords: np.ndarray) -> np.ndarray:
    centered = coords - np.median(coords, axis=0)
    radius = np.linalg.norm(centered, axis=1)
    scale = float(np.percentile(radius, 98)) or 1.0
    return centered / scale


def write_outputs(
    items: list[CorpusItem],
    coords: np.ndarray,
    neighbours: np.ndarray,
    candidate: Candidate,
    seed: int,
    report: dict[str, Any],
) -> None:
    coords = normalize_coordinates(coords)
    point_rows: list[list[Any]] = []
    metadata_rows: list[list[str]] = []
    for i, item in enumerate(items):
        point_rows.append(
            [
                item.collection_index,
                item.item_id,
                round(float(coords[i, 0]), 6),
                round(float(coords[i, 1]), 6),
                item.duplicate_count,
                *[int(value) for value in neighbours[i]],
            ]
        )
        metadata_rows.append([item.text, item.author, item.book, item.source, item.reference])

    points_payload = {
        "version": 2,
        "algorithm": {
            "key": candidate.key,
            "family": candidate.family,
            "nNeighbors": candidate.n_neighbors,
            "minDist": candidate.min_dist,
            "seed": seed,
            "semanticDimensions": int(report["pca"]["outputDimensions"]),
        },
        "collections": [
            {"slug": spec.slug, "label": spec.label, "colour": spec.colour} for spec in COLLECTIONS
        ],
        "columns": ["collection", "itemId", "x", "y", "duplicateCount", "neighbour0…7"],
        "points": point_rows,
    }
    metadata_payload = {
        "version": 2,
        "columns": ["text", "author", "book", "source", "reference"],
        "items": metadata_rows,
    }

    (PUBLIC / "cloud-points.json").write_text(json.dumps(points_payload, separators=(",", ":"), ensure_ascii=False))
    (PUBLIC / "cloud-metadata.json").write_text(json.dumps(metadata_payload, separators=(",", ":"), ensure_ascii=False))
    (PUBLIC / "cloud-projection-metrics.json").write_text(json.dumps(report, indent=2))
    legacy = PUBLIC / "cloud-projections.json"
    if legacy.exists():
        legacy.unlink()

    for filename in ("cloud-points.json", "cloud-metadata.json", "cloud-projection-metrics.json"):
        path = PUBLIC / filename
        log(f"  wrote {filename}: {path.stat().st_size / 1024 / 1024:.2f} MB")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--benchmark-size", type=int, default=10_000)
    parser.add_argument("--pca-dimensions", type=int, default=50)
    parser.add_argument("--algorithm", choices=("auto", *[candidate.key for candidate in CANDIDATES]), default="auto")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    started = time.time()
    log("Loading and conservatively deduplicating the existing corpus…")
    items, raw_matrix, report = load_corpus()
    report.update(
        {
            "version": 2,
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "seed": args.seed,
            "inputRows": sum(collection["inputRows"] for collection in report["collections"]),
            "outputPoints": len(items),
            "deduplication": "NFKC + case-fold + punctuation/whitespace normalization, within each collection",
            "densityPolicy": "corpus-proportional after deduplication; no collection sampling in the final map",
        }
    )

    log(f"\nFitting PCA-{args.pca_dimensions} on {len(items):,} normalized vectors…")
    pca_started = time.time()
    pca = PCA(n_components=args.pca_dimensions, svd_solver="randomized", random_state=args.seed)
    semantic_matrix = pca.fit_transform(raw_matrix).astype(np.float32, copy=False)
    normalize(semantic_matrix, norm="l2", copy=False)
    report["pca"] = {
        "inputDimensions": EMBEDDING_DIM,
        "outputDimensions": args.pca_dimensions,
        "explainedVariance": round(float(pca.explained_variance_ratio_.sum()), 6),
        "durationSeconds": round(time.time() - pca_started, 2),
    }
    del raw_matrix

    if args.algorithm == "auto":
        winner, benchmark_results = benchmark(semantic_matrix, items, args.benchmark_size, args.seed)
        report["benchmark"] = benchmark_results
    else:
        winner = next(candidate for candidate in CANDIDATES if candidate.key == args.algorithm)
        report["benchmark"] = []

    log(f"\nProjecting the complete cleaned corpus with {winner.key}…")
    projection_started = time.time()
    coords, projected_neighbours = project(semantic_matrix, winner, args.seed, args.verbose, return_neighbours=True)
    report["selected"] = {
        "key": winner.key,
        "family": winner.family,
        "nNeighbors": winner.n_neighbors,
        "minDist": winner.min_dist,
        "durationSeconds": round(time.time() - projection_started, 2),
        **quality_metrics(semantic_matrix, coords, args.seed),
    }

    neighbours, neighbour_report = semantic_neighbours(semantic_matrix, NEIGHBOUR_COUNT, args.seed, projected_neighbours)
    report["neighbours"] = neighbour_report
    report["durationSeconds"] = round(time.time() - started, 2)

    log("\nWriting compact graph and metadata artifacts…")
    write_outputs(items, coords, neighbours, winner, args.seed, report)
    log(f"\nDone in {report['durationSeconds'] / 60:.1f} minutes.")


if __name__ == "__main__":
    main()
