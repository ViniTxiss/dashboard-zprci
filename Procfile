web: export PYTHONPATH="${PYTHONPATH}:." && python3.11 -m gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
