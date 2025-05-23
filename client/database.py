"""
Database models and connection for the Telegram bot
"""
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
from config import DATABASE_URL

# Create SQLAlchemy base
Base = declarative_base()

class Message(Base):
    """Message entity for storing Telegram messages"""
    __tablename__ = 'messages'
    
    id = Column(Integer, primary_key=True)
    tg_id = Column(Integer, nullable=False, index=True)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    def __repr__(self):
        return f"<Message(tg_id={self.tg_id}, message='{self.message[:20]}...', timestamp={self.timestamp})>"

# Create engine and session
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def init_db():
    """Initialize the database, creating tables if they don't exist"""
    Base.metadata.create_all(engine)

def save_message(tg_id, message_text):
    """Save a message to the database
    
    Args:
        tg_id (int): Telegram user ID
        message_text (str): The transcribed message text
        
    Returns:
        Message: The created message object
    """
    session = Session()
    try:
        message = Message(tg_id=tg_id, message=message_text)
        session.add(message)
        session.commit()
        return message
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()
