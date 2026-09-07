-- Migration 245: Tự động chuyển toàn bộ Lead mới (01 - New Lead) đã có tương tác sang 02 - Contact Attempted
UPDATE contacts c
JOIN pipeline_stages ps2 ON ps2.tenant_id = c.tenant_id AND ps2.system_slug = 'contact_attempted'
LEFT JOIN pipeline_stages ps1 ON ps1.id = c.stage_id
SET c.stage_id = ps2.id,
    c.pipeline_status = 'contact_attempted'
WHERE (c.pipeline_status = 'new_lead' OR ps1.system_slug = 'new_lead' OR ps1.order_index = 1 OR c.stage_id = 1 OR c.stage_id IS NULL)
  AND (c.lead_status != 'lost' OR c.lead_status IS NULL)
  AND (
      EXISTS (
          SELECT 1 FROM activities a 
          WHERE ((a.related_type = 'contact' AND a.related_id = c.id) OR a.contact_id = c.id) 
            AND a.deleted_at IS NULL
      )
      OR EXISTS (
          SELECT 1 FROM notes n 
          WHERE n.entity_type = 'contact' AND n.entity_id = c.id 
            AND n.body NOT LIKE '[Tự động]%' 
            AND n.body NOT LIKE '[Phân bổ]%' 
            AND n.body NOT LIKE '[Giao data]%'
            AND n.body NOT LIKE '[Auto]%'
            AND n.body NOT LIKE '[Import]%'
            AND n.body NOT LIKE '[Tái phân bổ]%'
            AND n.body NOT LIKE 'Tái phân bổ%'
            AND n.body NOT LIKE 'Giao lại%'
      )
  );
