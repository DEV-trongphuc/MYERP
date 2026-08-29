-- Migration 238: Dọn sạch Stage cũ & Chuyển đổi toàn bộ Contacts/Deals sang 14 Stages chuẩn IDEAS

-- 1. Chuyển đổi trạng thái contacts cũ sang 14 slugs chuẩn
UPDATE `contacts` SET `pipeline_status` = 'new_lead' WHERE `pipeline_status` IN ('chua_xac_dinh', 'lead_moi', 'new', 'moi') OR `pipeline_status` IS NULL;
UPDATE `contacts` SET `pipeline_status` = 'contact_attempted' WHERE `pipeline_status` IN ('dang_tu_van', 'contacted', 'lien_he');
UPDATE `contacts` SET `pipeline_status` = 'needed' WHERE `pipeline_status` IN ('co_nhu_cau', 'qualified', 'nhu_cau');
UPDATE `contacts` SET `pipeline_status` = 'proposal_sent' WHERE `pipeline_status` IN ('gui_bao_gia', 'de_xuat_bao_gia', 'proposal', 'bao_gia');
UPDATE `contacts` SET `pipeline_status` = 'application_started' WHERE `pipeline_status` IN ('nop_ho_so', 'ho_so');
UPDATE `contacts` SET `pipeline_status` = 'application_completed' WHERE `pipeline_status` IN ('dong_le_phi_ho_so', 'phong_van', 'xet_tuyen');
UPDATE `contacts` SET `pipeline_status` = 'deposit_tuition_payment' WHERE `pipeline_status` IN ('dat_coc', 'deposit', 'coc');
UPDATE `contacts` SET `pipeline_status` = 'enrolled' WHERE `pipeline_status` IN ('hoc_vien', 'thanh_cong', 'dong_deal', 'won');
UPDATE `contacts` SET `pipeline_status` = 'new_lead', `lead_status` = 'lost', `lost_reason` = 'Bỏ theo dõi' WHERE `pipeline_status` IN ('bo_theo_doi', 'not_lead', 'that_bai', 'lost');

-- 2. Đồng bộ stage_id của contacts sang id tương ứng của 14 stages chuẩn
UPDATE `contacts` c
INNER JOIN `pipeline_stages` ps ON ps.system_slug = c.pipeline_status AND ps.tenant_id = c.tenant_id
SET c.stage_id = ps.id;

-- 3. Cập nhật stage_id cho deals nếu trỏ vào stage cũ
UPDATE `deals` d
INNER JOIN `contacts` c ON d.contact_id = c.id
SET d.stage_id = c.stage_id
WHERE d.stage_id NOT IN (
  SELECT id FROM `pipeline_stages` 
  WHERE system_slug IN ('new_lead', 'contact_attempted', 'connected', 'needed', 'discovery_completed', 'program_matched', 'proposal_sent', 'evaluation_objection', 'application_started', 'application_completed', 'admission_approved', 'offer_accepted', 'deposit_tuition_payment', 'enrolled')
);

-- 4. Xóa bỏ hoàn toàn các stages cũ không còn sử dụng trong pipeline_stages
DELETE FROM `pipeline_stages` 
WHERE system_slug NOT IN (
  'new_lead', 'contact_attempted', 'connected', 'needed', 
  'discovery_completed', 'program_matched', 'proposal_sent', 
  'evaluation_objection', 'application_started', 'application_completed', 
  'admission_approved', 'offer_accepted', 'deposit_tuition_payment', 'enrolled'
) OR system_slug IS NULL;
