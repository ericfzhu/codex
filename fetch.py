import ebooklib
from ebooklib import epub
import pandas as pd
from bs4 import BeautifulSoup
import csv
import requests

# Path to the EPUB file and the output CSV file
epub_file_path = 'calendar of wisdom.epub'
output_csv_file = 'calendar_quotes.csv'

# Read EPUB content
book = epub.read_epub(epub_file_path)
content = []
for item in book.get_items():
    if item.get_type() == ebooklib.ITEM_DOCUMENT:
        content.append(item.get_body_content())

# Parse quotes and authors
quotes_data = []
for html_content in content:
    soup = BeautifulSoup(html_content, 'html.parser')
    for quote_tag in soup.find_all('p', class_='calibre15'):
        # Replace <br> tags with newlines
        for br in quote_tag.find_all('br'):
            br.replace_with('\n')

        quote = quote_tag.get_text()

        # Find the author in the next sibling with class 'calibre16'
        author_tag = quote_tag.find_next_sibling('p', class_='calibre16')
        author = author_tag.get_text(strip=True) if author_tag else "Leo Tolstoy"

        quotes_data.append((quote, author))


for html_content in content:
    soup = BeautifulSoup(html_content, 'html.parser')
    for quote_tag in soup.find_all('blockquote'):
        quote = quote_tag.get_text(strip=True)

        # Find the author
        author_tag = quote_tag.find_next_sibling('p')
        author = author_tag.get_text(strip=True) if author_tag and author_tag.get_text(strip=True).startswith("—") else "Leo Tolstoy"

        quotes_data.append((quote, author))

# Save to CSV
with open(output_csv_file, 'w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    writer.writerow(['Quote', 'Author'])  # Writing header
    for quote, author in quotes_data:
        writer.writerow([quote, author])



def scrape_quotes(page):
    url = f"https://www.goodreads.com/quotes?page={page}"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    quotes_data = []
    quotes = soup.find_all('div', class_='quoteDetails')

    for quote in quotes:
        quote_text_div = quote.find('div', class_='quoteText')

        # Replacing <br> tags within the quote with \n
        for br in quote_text_div.find_all("br"):
            br.replace_with("\n")

        # Extracting the quote text up to the "―"
        text = quote_text_div.get_text().split("―")[0].strip()

        author = quote.find('span', class_='authorOrTitle').text.strip().replace(',', '')

        # Extracting book title if present
        book_link = quote.find('a', class_='authorOrTitle')
        book_title = book_link.text.strip() if book_link else ''

        quotes_data.append((text, author, book_title))

    return quotes_data


all_quotes = []
for page in range(1, 101):
    quotes = scrape_quotes(page)
    all_quotes.extend(quotes)

with open('goodreads_quotes.csv', 'w', newline='', encoding='utf-8') as file:
    writer = csv.writer(file)
    writer.writerow(['Quote', 'Author', 'Book Title'])
    writer.writerows(all_quotes)


# Read the CSV files
goodreads_quotes = pd.read_csv('goodreads_quotes.csv')
calendar_quotes = pd.read_csv('calendar_quotes.csv')

# Combine the dataframes
quotes = pd.concat([goodreads_quotes, calendar_quotes])

# Remove any rows where 'Quote' is empty or null
quotes = quotes[quotes['Quote'].notna()]

quotes['Quote'] = quotes['Quote'].apply(lambda x: x[1:-1] if (x.startswith('“') and x.endswith('”')) else x)
quotes['Quote'] = quotes['Quote'].apply(lambda x: x[1:-1] if (x.startswith('"') and x.endswith('"')) else x)
quotes = quotes[quotes['Quote'].apply(lambda x: any(c.isalpha() for c in x if c.isascii()))]
quotes['Author'] = quotes['Author'].str.replace('—', '')
quotes['Author'] = quotes['Author'].str.replace('From ', '')
quotes['Author'] = quotes['Author'].apply(lambda x: x[6:] if x.startswith('After') else x)
quotes['Author'] = quotes['Author'].str.title()

quotes.to_csv('quotes.csv', index=False)
