-- Closure Proposals Review
-- Run manually when you want to see what LLM wanted to close.
-- Approve: UPDATE vanguard_stream_closure_proposals SET status='approved', resolved_at=now() WHERE id='...';
-- Reject:  UPDATE vanguard_stream_closure_proposals SET status='rejected', resolved_at=now() WHERE id='...';

SELECT
  p.id,
  p.created_at::date                          AS proposed_on,
  p.closed_topic_description,
  array_length(p.target_record_ids, 1)        AS targets_count,
  s.content                                   AS triggering_note,
  p.similarity_threshold,
  p.status
FROM vanguard_stream_closure_proposals p
LEFT JOIN vanguard_stream s ON s.id = p.proposed_by_record_id
WHERE p.status = 'pending'
ORDER BY p.created_at DESC;
