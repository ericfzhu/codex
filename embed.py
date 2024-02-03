from openai import OpenAI
import os

from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])


import pandas as pd

# Load the CSV file
quotes_df = pd.read_csv('quotes.csv')

# Embed the "Quote" column
embeddings = []
batch_size = 2000
for i in range(0, len(quotes_df['Quote']), batch_size):
    batch = quotes_df['Quote'][i:i+batch_size].tolist()
    batch_embeddings = client.embeddings.create(model="text-embedding-3-small", input=batch)
    for embedding in batch_embeddings.data:
        embeddings.append(embedding.embedding)
# Add the embeddings to the dataframe
quotes_df['Embeddings'] = embeddings

# Save the dataframe to a new CSV file
quotes_df.to_csv('quotes.csv', index=False)
