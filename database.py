import clickhouse_connect

# For now, this points to your local machine
client = clickhouse_connect.get_client(
    host='localhost', 
    port=8123, 
    username='default', 
    password=''
)

def run_query(query: str):
    return client.query(query).result_rows