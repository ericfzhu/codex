import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloudCollection, CloudMetadataPayload, CloudPoint, CloudPointsPayload } from '@/types';

interface RenderPoint {
	index: number;
	x: number;
	y: number;
	point: CloudPoint;
}

interface Filter {
	type: 'author' | 'book' | 'religion';
	value: string;
}

interface CloudProps {
	showFilters: boolean;
	onToggleFilters: () => void;
}

interface Buffers {
	position: WebGLBuffer | null;
	color: WebGLBuffer | null;
	size: WebGLBuffer | null;
	isLocked: WebGLBuffer | null;
	connections: WebGLBuffer | null;
}

const POINT_SCALE = 600;

const pointVertexShader = `
	attribute vec2 a_position;
	attribute vec3 a_color;
	attribute float a_size;
	attribute float a_isLocked;
	uniform vec2 u_resolution;
	uniform vec2 u_translation;
	uniform float u_scale;
	varying vec3 v_color;
	varying float v_isLocked;
	void main() {
		vec2 screen = a_position * u_scale + u_translation + u_resolution * 0.5;
		vec2 clip = screen / u_resolution * 2.0 - 1.0;
		gl_Position = vec4(clip.x, -clip.y, 0, 1);
		gl_PointSize = a_size;
		v_color = a_color;
		v_isLocked = a_isLocked;
	}
`;

const pointFragmentShader = `
	precision mediump float;
	varying vec3 v_color;
	varying float v_isLocked;
	void main() {
		vec2 coord = gl_PointCoord - vec2(0.5);
		float dist = length(coord);
		if (dist > 0.5) discard;
		if (v_isLocked > 0.5 && dist > 0.34) {
			gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
		} else {
			gl_FragColor = vec4(v_color, 1.0);
		}
	}
`;

const lineVertexShader = `
	attribute vec2 a_position;
	uniform vec2 u_resolution;
	uniform vec2 u_translation;
	uniform float u_scale;
	void main() {
		vec2 screen = a_position * u_scale + u_translation + u_resolution * 0.5;
		vec2 clip = screen / u_resolution * 2.0 - 1.0;
		gl_Position = vec4(clip.x, -clip.y, 0, 1);
	}
`;

const lineFragmentShader = `
	precision mediump float;
	void main() {
		gl_FragColor = vec4(1.0, 0.96, 0.84, 0.28);
	}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('Shader compile error:', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
	const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
	const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
	if (!vertexShader || !fragmentShader) return null;
	const program = gl.createProgram();
	if (!program) return null;
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Program link error:', gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}
	return program;
}

function hexToRgb(hex: string): [number, number, number] {
	const value = hex.replace('#', '');
	const integer = Number.parseInt(value, 16);
	return [((integer >> 16) & 255) / 255, ((integer >> 8) & 255) / 255, (integer & 255) / 255];
}

function decodePoints(payload: CloudPointsPayload): CloudPoint[] {
	return payload.points.map((row) => ({
		collection: row[0],
		itemId: row[1],
		x: row[2],
		y: row[3],
		duplicateCount: row[4],
		neighbours: row.slice(5),
	}));
}

function pointKey(collections: CloudCollection[], point: CloudPoint): string {
	return `${collections[point.collection]?.slug ?? point.collection}:${point.itemId}`;
}

function setTransformUniforms(
	gl: WebGLRenderingContext,
	program: WebGLProgram,
	width: number,
	height: number,
	transform: { x: number; y: number; scale: number }
) {
	gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height);
	gl.uniform2f(gl.getUniformLocation(program, 'u_translation'), transform.x, transform.y);
	gl.uniform1f(gl.getUniformLocation(program, 'u_scale'), transform.scale);
}

export default function Cloud({ showFilters }: CloudProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const glRef = useRef<WebGLRenderingContext | null>(null);
	const pointProgramRef = useRef<WebGLProgram | null>(null);
	const lineProgramRef = useRef<WebGLProgram | null>(null);
	const buffersRef = useRef<Buffers>({ position: null, color: null, size: null, isLocked: null, connections: null });
	const pointsRef = useRef<RenderPoint[]>([]);

	const [graph, setGraph] = useState<{ points: CloudPoint[]; collections: CloudCollection[]; algorithm: CloudPointsPayload['algorithm'] } | null>(null);
	const [metadata, setMetadata] = useState<CloudMetadataPayload | null>(null);
	const [loadError, setLoadError] = useState('');
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const [lockedIndex, setLockedIndex] = useState<number | null>(null);
	const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.72 });
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [clickStart, setClickStart] = useState<{ x: number; y: number } | null>(null);
	const [activeFilters, setActiveFilters] = useState<Filter[]>([]);
	const [searchTerm, setSearchTerm] = useState('');

	useEffect(() => {
		const controller = new AbortController();
		const loadGraph = async () => {
			try {
				const response = await fetch('/cloud-points.json', { signal: controller.signal });
				if (!response.ok) throw new Error(`Point graph returned ${response.status}`);
				const payload = (await response.json()) as CloudPointsPayload;
				setGraph({ points: decodePoints(payload), collections: payload.collections, algorithm: payload.algorithm });
			} catch (error) {
				if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load the point graph');
			}
		};
		const loadMetadata = async () => {
			try {
				const response = await fetch('/cloud-metadata.json', { signal: controller.signal });
				if (!response.ok) throw new Error(`Metadata returned ${response.status}`);
				setMetadata((await response.json()) as CloudMetadataPayload);
			} catch (error) {
				if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load cloud metadata');
			}
		};
		void loadGraph();
		void loadMetadata();
		return () => controller.abort();
	}, []);

	const filterValues = useMemo(() => {
		if (!graph || !metadata) return { authors: [] as string[], books: [] as string[], religions: [] as string[] };
		return {
			authors: Array.from(new Set(metadata.items.map((item) => item[1]).filter(Boolean))).sort(),
			books: Array.from(new Set(metadata.items.map((item) => item[2]).filter(Boolean))).sort(),
			religions: graph.collections.map((collection) => collection.label).sort(),
		};
	}, [graph, metadata]);

	useEffect(() => {
		if (!graph) return;
		pointsRef.current = graph.points.map((point, index) => ({ index, x: point.x * POINT_SCALE, y: point.y * POINT_SCALE, point }));
	}, [graph]);

	const matchesFilters = useCallback(
		(index: number) => {
			if (!graph || !metadata || activeFilters.length === 0) return true;
			const point = graph.points[index];
			const item = metadata.items[index];
			return activeFilters.every((filter) => {
				if (filter.type === 'author') return item?.[1] === filter.value;
				if (filter.type === 'book') return item?.[2] === filter.value;
				return graph.collections[point.collection]?.label === filter.value;
			});
		},
		[activeFilters, graph, metadata]
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const gl = canvas.getContext('webgl', { antialias: true });
		if (!gl) {
			setLoadError('WebGL is not available in this browser');
			return;
		}
		glRef.current = gl;
		pointProgramRef.current = createProgram(gl, pointVertexShader, pointFragmentShader);
		lineProgramRef.current = createProgram(gl, lineVertexShader, lineFragmentShader);
		buffersRef.current = {
			position: gl.createBuffer(),
			color: gl.createBuffer(),
			size: gl.createBuffer(),
			isLocked: gl.createBuffer(),
			connections: gl.createBuffer(),
		};
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	}, []);

	useEffect(() => {
		const gl = glRef.current;
		if (!gl || !graph || !buffersRef.current.position) return;
		const points = pointsRef.current;
		const positions = new Float32Array(points.length * 2);
		const colors = new Float32Array(points.length * 3);
		const sizes = new Float32Array(points.length);
		const isLocked = new Float32Array(points.length);
		const related = new Set(lockedIndex === null ? [] : graph.points[lockedIndex]?.neighbours);
		const hasFilters = activeFilters.length > 0;

		points.forEach((renderPoint, index) => {
			positions[index * 2] = renderPoint.x;
			positions[index * 2 + 1] = renderPoint.y;
			const collection = graph.collections[renderPoint.point.collection];
			const base = hexToRgb(collection?.colour ?? '#777777');
			const selected = lockedIndex === index;
			const neighbour = related.has(index);
			const matches = matchesFilters(index);
			isLocked[index] = selected ? 1 : 0;
			if (hasFilters && !matches) {
				colors.set([0.12, 0.12, 0.14], index * 3);
				sizes[index] = 4;
			} else if (selected) {
				colors.set(base, index * 3);
				sizes[index] = 25;
			} else if (neighbour) {
				colors.set([0.96, 0.91, 0.76], index * 3);
				sizes[index] = 15;
			} else {
				colors.set(base, index * 3);
				sizes[index] = hasFilters ? 13 : 8;
			}
		});

		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.position);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.color);
		gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.size);
		gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.isLocked);
		gl.bufferData(gl.ARRAY_BUFFER, isLocked, gl.STATIC_DRAW);

		const locked = lockedIndex === null ? null : points[lockedIndex];
		const connectionPositions = locked
			? new Float32Array(
					locked.point.neighbours.flatMap((neighbourIndex) => {
						const neighbour = points[neighbourIndex];
						return neighbour ? [locked.x, locked.y, neighbour.x, neighbour.y] : [];
					})
			  )
			: new Float32Array();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.connections);
		gl.bufferData(gl.ARRAY_BUFFER, connectionPositions, gl.STATIC_DRAW);
	}, [activeFilters, graph, lockedIndex, matchesFilters, metadata]);

	const draw = useCallback(() => {
		const gl = glRef.current;
		const canvas = canvasRef.current;
		const pointProgram = pointProgramRef.current;
		const lineProgram = lineProgramRef.current;
		const buffers = buffersRef.current;
		if (!gl || !canvas || !pointProgram || !lineProgram || !buffers.position) return;
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		if (lockedIndex !== null && buffers.connections) {
			gl.useProgram(lineProgram);
			setTransformUniforms(gl, lineProgram, canvas.width, canvas.height, transform);
			const position = gl.getAttribLocation(lineProgram, 'a_position');
			gl.bindBuffer(gl.ARRAY_BUFFER, buffers.connections);
			gl.enableVertexAttribArray(position);
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.LINES, 0, (graph?.points[lockedIndex]?.neighbours.length ?? 0) * 2);
		}

		gl.useProgram(pointProgram);
		setTransformUniforms(gl, pointProgram, canvas.width, canvas.height, transform);
		const attributes = [
			['a_position', buffers.position, 2],
			['a_color', buffers.color, 3],
			['a_size', buffers.size, 1],
			['a_isLocked', buffers.isLocked, 1],
		] as const;
		attributes.forEach(([name, buffer, size]) => {
			const location = gl.getAttribLocation(pointProgram, name);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(location);
			gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
		});
		gl.drawArrays(gl.POINTS, 0, pointsRef.current.length);
	}, [graph, lockedIndex, transform]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const resize = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			draw();
		};
		resize();
		window.addEventListener('resize', resize);
		return () => window.removeEventListener('resize', resize);
	}, [draw]);

	useEffect(() => draw(), [activeFilters, draw, graph, lockedIndex, metadata]);

	const findPointAtMouse = useCallback(
		(event: React.MouseEvent): RenderPoint | null => {
			const canvas = canvasRef.current;
			if (!canvas) return null;
			const rect = canvas.getBoundingClientRect();
			const screenX = event.clientX - rect.left - rect.width / 2;
			const screenY = event.clientY - rect.top - rect.height / 2;
			const worldX = (screenX - transform.x) / transform.scale;
			const worldY = (screenY - transform.y) / transform.scale;
			const threshold = 13 / transform.scale;
			let closest: RenderPoint | null = null;
			let closestDistance = Infinity;
			for (const point of pointsRef.current) {
				const distance = Math.hypot(point.x - worldX, point.y - worldY);
				if (distance < threshold && distance < closestDistance) {
					closest = point;
					closestDistance = distance;
				}
			}
			return closest;
		},
		[transform]
	);

	const handleMouseDown = (event: React.MouseEvent) => {
		setIsDragging(true);
		setDragStart({ x: event.clientX - transform.x, y: event.clientY - transform.y });
		setClickStart({ x: event.clientX, y: event.clientY });
	};

	const handleMouseMove = (event: React.MouseEvent) => {
		if (isDragging) {
			setTransform((previous) => ({ ...previous, x: event.clientX - dragStart.x, y: event.clientY - dragStart.y }));
		} else {
			setHoveredIndex(findPointAtMouse(event)?.index ?? null);
		}
	};

	const handleMouseUp = (event: React.MouseEvent) => {
		if (clickStart && Math.hypot(event.clientX - clickStart.x, event.clientY - clickStart.y) < 5) {
			const closest = findPointAtMouse(event);
			setLockedIndex((current) => (closest ? (current === closest.index ? null : closest.index) : null));
		}
		setIsDragging(false);
		setClickStart(null);
	};

	const handleWheel = (event: React.WheelEvent) => {
		event.preventDefault();
		const canvas = canvasRef.current;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const screenX = event.clientX - rect.left - rect.width / 2;
		const screenY = event.clientY - rect.top - rect.height / 2;
		const nextScale = Math.max(0.15, Math.min(16, transform.scale * (event.deltaY > 0 ? 0.9 : 1.1)));
		const worldX = (screenX - transform.x) / transform.scale;
		const worldY = (screenY - transform.y) / transform.scale;
		setTransform({ x: screenX - worldX * nextScale, y: screenY - worldY * nextScale, scale: nextScale });
	};

	const toggleFilter = (type: Filter['type'], value: string) => {
		setActiveFilters((previous) => {
			const exists = previous.some((filter) => filter.type === type && filter.value === value);
			return exists ? previous.filter((filter) => !(filter.type === type && filter.value === value)) : [...previous, { type, value }];
		});
	};

	const clearFilters = () => {
		setActiveFilters([]);
		setSearchTerm('');
	};

	const displayIndex = lockedIndex ?? hoveredIndex;
	const displayPoint = displayIndex === null ? null : graph?.points[displayIndex];
	const displayMetadata = displayIndex === null ? null : metadata?.items[displayIndex];
	const displayCollection = displayPoint ? graph?.collections[displayPoint.collection] : null;
	const search = searchTerm.toLowerCase();
	const filteredAuthors = filterValues.authors.filter((value) => value.toLowerCase().includes(search));
	const filteredBooks = filterValues.books.filter((value) => value.toLowerCase().includes(search));
	const filteredReligions = filterValues.religions.filter((value) => value.toLowerCase().includes(search));

	return (
		<div className="relative h-screen w-full bg-black antialiased">
			<canvas
				ref={canvasRef}
				className="h-full w-full cursor-crosshair"
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={() => {
					setIsDragging(false);
					setClickStart(null);
				}}
				onWheel={handleWheel}
			/>

			{!graph && !loadError && (
				<div className="pointer-events-none fixed inset-0 grid place-items-center text-[10px] font-mono uppercase tracking-[0.22em] text-white/45">
					Mapping the corpus…
				</div>
			)}
			{loadError && (
				<div className="fixed left-4 top-4 max-w-sm bg-[#b91c1c] p-4 text-xs text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
					Could not load the cloud: {loadError}
				</div>
			)}

			{graph && (
				<div className="pointer-events-none fixed left-4 top-4 z-40 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
					<p className="tabular-nums">{graph.points.length.toLocaleString()} unique texts</p>
					<p>{graph.algorithm.family} · semantic neighbours</p>
				</div>
			)}

			{showFilters && (
				<div className="fixed right-4 top-16 z-50 flex max-h-[72vh] w-80 flex-col bg-black/95 p-4 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-sm">
					<div className="mb-3 flex items-center justify-between">
						<span className="font-mono text-xs uppercase tracking-[0.18em]">Filters</span>
						{activeFilters.length > 0 && (
							<button onClick={clearFilters} className="min-h-10 px-2 font-mono text-[10px] uppercase tracking-wider text-white/60 transition-colors duration-150 hover:text-white active:scale-[0.96]">
								Clear all
							</button>
						)}
					</div>
					<input
						type="search"
						placeholder="SEARCH AUTHORS OR BOOKS"
						value={searchTerm}
						onChange={(event) => setSearchTerm(event.target.value)}
						className="mb-3 min-h-10 w-full border border-white/20 bg-white/5 px-3 py-2 font-mono text-xs text-white outline-none transition-colors duration-150 placeholder:text-white/30 focus:border-white/60"
					/>
					<div className="flex-1 space-y-4 overflow-y-auto">
						{activeFilters.length > 0 && (
							<div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
								{activeFilters.map((filter) => (
									<button key={`${filter.type}:${filter.value}`} onClick={() => toggleFilter(filter.type, filter.value)} className="min-h-10 bg-white px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-black transition-[scale,background-color] duration-150 hover:bg-[#f0e7cf] active:scale-[0.96]">
										{filter.value} ×
									</button>
								))}
							</div>
						)}

						<FilterGroup label="Traditions" values={filteredReligions} activeFilters={activeFilters} type="religion" onToggle={toggleFilter} />
						<FilterGroup label="Authors" values={filteredAuthors.slice(0, 50)} overflow={filteredAuthors.length - 50} activeFilters={activeFilters} type="author" onToggle={toggleFilter} />
						<FilterGroup label="Books" values={filteredBooks.slice(0, 50)} overflow={filteredBooks.length - 50} activeFilters={activeFilters} type="book" onToggle={toggleFilter} />
					</div>
				</div>
			)}

			{graph && displayPoint && displayCollection && (
				<aside className="fixed bottom-4 right-4 z-40 w-[min(28rem,calc(100vw-2rem))] min-w-0 overflow-hidden bg-black/95 p-5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-sm">
					<div className="mb-3 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.16em]">
						<button onClick={() => toggleFilter('religion', displayCollection.label)} className="min-h-10 text-left transition-colors duration-150 hover:text-white active:scale-[0.96]" style={{ color: displayCollection.colour }}>
							{displayCollection.label}
						</button>
						<span className="tabular-nums text-white/35">{pointKey(graph?.collections ?? [], displayPoint)}</span>
					</div>
					{displayMetadata ? (
						<>
							<p className="text-pretty font-serif text-sm italic leading-relaxed text-white/90">&ldquo;{displayMetadata[0]}&rdquo;</p>
							<p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-white/50">
								{[displayMetadata[1], displayMetadata[2], displayMetadata[4]].filter(Boolean).join(' · ')}
							</p>
							{displayPoint.duplicateCount > 1 && <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/35">Represents {displayPoint.duplicateCount} duplicate records</p>}
						</>
					) : (
						<p className="font-mono text-xs uppercase tracking-wider text-white/40">Loading text…</p>
					)}

					{lockedIndex !== null && metadata && (
						<div className="mt-5 border-t border-white/10 pt-3">
							<p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">Closest in semantic space</p>
							<div className="grid min-w-0 gap-px overflow-hidden bg-white/10">
								{displayPoint.neighbours.slice(0, 3).map((neighbourIndex) => {
									const neighbour = graph.points[neighbourIndex];
									const neighbourMetadata = metadata.items[neighbourIndex];
									const collection = graph.collections[neighbour.collection];
									return (
										<button key={pointKey(graph.collections, neighbour)} onClick={() => setLockedIndex(neighbourIndex)} className="min-h-10 min-w-0 overflow-hidden bg-black px-3 py-2 text-left transition-[scale,background-color] duration-150 hover:bg-white/10 active:scale-[0.96]">
											<span className="block truncate font-serif text-xs text-white/75">{neighbourMetadata?.[0] ?? 'Loading text…'}</span>
											<span className="mt-1 block font-mono text-[9px] uppercase tracking-wider" style={{ color: collection.colour }}>{collection.label}</span>
										</button>
									);
								})}
							</div>
						</div>
					)}
				</aside>
			)}
		</div>
	);
}

interface FilterGroupProps {
	label: string;
	values: string[];
	overflow?: number;
	activeFilters: Filter[];
	type: Filter['type'];
	onToggle: (type: Filter['type'], value: string) => void;
}

function FilterGroup({ label, values, overflow = 0, activeFilters, type, onToggle }: FilterGroupProps) {
	if (values.length === 0) return null;
	return (
		<section>
			<p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-white/45">{label}</p>
			<div className="max-h-40 overflow-y-auto">
				{values.map((value) => {
					const active = activeFilters.some((filter) => filter.type === type && filter.value === value);
					return (
						<button key={value} onClick={() => onToggle(type, value)} className={`block min-h-10 w-full px-2 py-2 text-left font-mono text-xs transition-[scale,background-color,color] duration-150 active:scale-[0.96] ${active ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
							{value}
						</button>
					);
				})}
				{overflow > 0 && <p className="px-2 py-1 font-mono text-[10px] text-white/30">+{overflow} more</p>}
			</div>
		</section>
	);
}
