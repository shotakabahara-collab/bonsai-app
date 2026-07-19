#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'next' / 'src' / 'model.ts'
text = path.read_text(encoding='utf-8')

old = """      scar: clamp(finite(legacy.scar, 0)),
      wire: typeof legacy.wire === 'string'
        ? { intensity: legacy.wire === 'strong' ? 'strong' : 'light', direction: 'down', appliedAt: Date.now() }
        : wireSource.intensity
          ? {
              intensity: wireSource.intensity === 'strong' ? 'strong' : 'light',
              direction: isWireDirection(wireSource.direction) ? wireSource.direction : 'down',
              appliedAt: finite(wireSource.appliedAt, Date.now())
            }
          : undefined,
"""
new = """      scar: clamp(finite(legacy.scar, 0)),
      trainedDirection: isWireDirection(legacy.trainedDirection) ? legacy.trainedDirection : undefined,
      shapeRetention: legacy.shapeRetention === undefined ? undefined : clamp(finite(legacy.shapeRetention, 0)),
      wireRemovedAt: finite(legacy.wireRemovedAt, 0) || undefined,
      wire: typeof legacy.wire === 'string'
        ? { intensity: legacy.wire === 'strong' ? 'strong' : 'light', direction: 'down', appliedAt: Date.now() }
        : wireSource.intensity
          ? {
              intensity: wireSource.intensity === 'strong' ? 'strong' : 'light',
              direction: isWireDirection(wireSource.direction) ? wireSource.direction : 'down',
              appliedAt: finite(wireSource.appliedAt, Date.now()),
              readyAt: finite(wireSource.readyAt, 0) || undefined,
              progress: wireSource.progress === undefined ? undefined : clamp(finite(wireSource.progress, 0)),
              status: ['training', 'ready', 'overdue'].includes(String(wireSource.status)) ? wireSource.status as WireTrainingStatus : undefined,
              lastRiskAt: finite(wireSource.lastRiskAt, 0) || undefined
            }
          : undefined,
"""
if old not in text:
    raise SystemExit('migrateParts wire marker missing')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('wire lifecycle normalization preserved')
