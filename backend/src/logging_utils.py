import logging
import logging.handlers
import os
import sys
from typing import Optional, Union

class AdvancedLogger:
    _instance: Optional[logging.Logger] = None

    @classmethod
    def get_logger(
        cls,
        directory_log: Optional[str] = None,
        log_level: Union[int, str] = logging.INFO,
        max_size_log: int = 5 * 1024 * 1024,  # 5MB
        backup_number: int = 5
    ) -> logging.Logger:
        """
        Create a singleton advanced logger with log management on file and console.

        :param directory_log: Log directory
        :param log_level: Log level
        :param max_size_log: Maximum size of the log file
        :param backup_number: Number of backup log files
        :return: Logger instance
        """
        # If an instance already exists, return it
        if cls._instance is not None:
            return cls._instance

        # Determine the default name from the current script
        default_name = "Test"

        # Determine the default directory and create the directory if it does not exist
        if directory_log is None:
            directory_log = os.path.join('../log/', default_name)
        os.makedirs(directory_log, exist_ok=True)

        # Create the logger
        logger = logging.getLogger(default_name)
        logger.setLevel(log_level)
        logger.handlers.clear()  # Remove the default handler if it exists

        # Formatter for the message format
        msg_format = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(log_level)
        console_handler.setFormatter(msg_format)
        logger.addHandler(console_handler)

        # File handler
        log_path = os.path.join(directory_log, f'{default_name}.log')
        file_handler = logging.handlers.RotatingFileHandler(
            log_path,
            maxBytes=max_size_log,
            backupCount=backup_number
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(msg_format)
        logger.addHandler(file_handler)

        # Store the logger instance
        cls._instance = logger

        return logger
