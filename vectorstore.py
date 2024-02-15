from pinecone import Pinecone, ServerlessSpec
import os
import time
import pandas as pd

from dotenv import load_dotenv
load_dotenv()

pc = Pinecone(api_key=os.environ['PINECONE_API_KEY'])
index_name = "codex"
dimension = 1536


if index_name not in pc.list_indexes().names():
    pc.create_index(
        name=index_name,
        dimension=dimension,
        metric="dotproduct",
        spec=ServerlessSpec(
            cloud="aws",
            region="us-west-2",
        ),
    )

    while not pc.describe_index(index_name).status['ready']:
        print("Waiting for index to be created...")
        time.sleep(1)

index = pc.Index(index_name)

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

# Prepare the data for insertion
batch_size = 100
for i in range(0, len(quotes_df), batch_size):
    vectors = []
    for j in range(i, min(i + batch_size, len(quotes_df))):
        row = quotes_df.iloc[j]
        quote, author, book_title, embedding = row['Quote'], row['Author'], row['Book Title'], row['Embeddings']
        # Replace NaN values with empty string
        author = author if pd.notna(author) else ""
        book_title = book_title if pd.notna(book_title) else ""
        metadata = {"quote": quote, "author": author, "book_title": book_title}
        vectors.append((str(j), embedding, metadata))
    # Insert the data into the index
    index.upsert(vectors=vectors)
