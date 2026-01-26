from sqlmodel import SQLModel, create_engine, Session
import os

# Dev: Use SQLite for now, easy to switch to Postgres later
sqlite_file_name = "networth_v2.db"
# Use absolute path relative to where we run the server, or just nice local path
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)
