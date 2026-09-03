import {
  abandonFileMetadata, activateFileMetadata, finalizeFileDeletion, findFileMetadataByObjectKey,
  listFileMetadataForReconciliation, removeMissingFileMetadata, type Database
} from '@dentivohq/db';

type FileObjectStatus = 'PENDING_UPLOAD' | 'ACTIVE' | 'DELETE_PENDING';
export type FileReconciliationAction = 'ACTIVATE' | 'ABANDON' | 'DELETE' | 'REMOVE_MISSING' | 'NONE';

export function fileReconciliationAction(status: FileObjectStatus, objectExists: boolean): FileReconciliationAction {
  if (status === 'DELETE_PENDING') return 'DELETE';
  if (status === 'PENDING_UPLOAD') return objectExists ? 'ACTIVATE' : 'ABANDON';
  return objectExists ? 'NONE' : 'REMOVE_MISSING';
}

export async function reconcileFileStorage(db: Database, bucket: R2Bucket) {
  const records = await listFileMetadataForReconciliation(db);
  for (const record of records) {
    const clinicId = String(record.clinic_id);
    const fileId = String(record.id);
    const objectKey = String(record.object_key);
    try {
      const status = String(record.status) as FileObjectStatus;
      const objectExists = status === 'DELETE_PENDING' ? false : Boolean(await bucket.head(objectKey));
      const action = fileReconciliationAction(status, objectExists);
      if (action === 'DELETE') {
        await bucket.delete(objectKey);
        await finalizeFileDeletion(db, clinicId, fileId);
      } else if (action === 'ACTIVATE') {
        await activateFileMetadata(db, clinicId, fileId);
      } else if (action === 'ABANDON') {
        await abandonFileMetadata(db, clinicId, fileId);
      } else if (action === 'REMOVE_MISSING') {
        await removeMissingFileMetadata(db, clinicId, fileId);
      }
    } catch {
      console.error(JSON.stringify({ level: 'error', code: 'FILE_RECONCILIATION_FAILED', fileId }));
    }
  }

  const objects = await bucket.list({ prefix: 'clinics/', limit: 1000 });
  for (const object of objects.objects) {
    if (!await findFileMetadataByObjectKey(db, object.key)) await bucket.delete(object.key);
  }
}
