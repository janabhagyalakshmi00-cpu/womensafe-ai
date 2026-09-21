from pathlib import Path

from app import db
from app.detector import process_run

sample = Path('/home/ubuntu/womensafe-ai/backend/data/sample_cctv.mp4')
run_id = 'verification-run'
existing = db.get_run(run_id)
if existing:
    with db._connect() as connection:
        connection.execute('DELETE FROM alerts WHERE run_id = ?', (run_id,))
        connection.execute('DELETE FROM events WHERE run_id = ?', (run_id,))
        connection.execute('DELETE FROM analysis_runs WHERE id = ?', (run_id,))
run = db.create_run(run_id, sample.name, str(sample))
process_run(run_id)
result = db.decode_run(db.get_run(run_id))
print({
    'status': result['status'],
    'processed_frames': result['processed_frames'],
    'max_people': result['max_people'],
    'total_people': result['total_people'],
    'alerts': [alert['alert_type'] for alert in (result.get('results') or {}).get('alerts', [])],
    'annotated_exists': Path(result['annotated_path']).exists() if result.get('annotated_path') else False,
    'preview_exists': Path(result['preview_path']).exists() if result.get('preview_path') else False,
})
if result['status'] != 'completed' or result['max_people'] <= 0:
    raise SystemExit('Real YOLO verification did not detect people')
