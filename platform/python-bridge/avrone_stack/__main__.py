"""Prefer FastAPI app when deps exist; else stdlib server."""

try:
    from .app import main
except ImportError:
    from .stdlib_server import main

if __name__ == "__main__":
    main()
