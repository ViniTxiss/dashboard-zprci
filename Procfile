web: export PYTHONPATH="${PYTHONPATH}:." && gunicorn backend.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --pythonpath .
