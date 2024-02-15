import pandas as pd

def string_to_float_list(string) -> list[float]:
    """
    Convert a string to a list of floats

    Args:
        string: String to convert

    Returns:
        List of floats
    """
    return [float(x) for x in string.strip("[]").split(",")]

# Load the CSV file
quotes_df = pd.read_csv('quotes.csv', converters={"Embeddings": string_to_float_list})

import umap

# Reduce the embeddings to 2 dimensions
reducer_2d = umap.UMAP(n_components=2)
embeddings_2d = reducer_2d.fit_transform(quotes_df['Embeddings'].tolist())
quotes_df['Embeddings_2D'] = embeddings_2d.tolist()

# Reduce the embeddings to 3 dimensions
reducer_3d = umap.UMAP(n_components=3)
embeddings_3d = reducer_3d.fit_transform(quotes_df['Embeddings'].tolist())
quotes_df['Embeddings_3D'] = embeddings_3d.tolist()

# Remove the 'Embeddings' column
quotes_df = quotes_df.drop(columns=['Embeddings'])


quotes_df.to_csv('quotes_with_embeddings.csv', index=False)