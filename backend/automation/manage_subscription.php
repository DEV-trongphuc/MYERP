<?php
require_once __DIR__ . '/db_connect.php';
if (session_status() === PHP_SESSION_ACTIVE) {
    session_destroy();
}
header('Content-Type: text/html; charset=UTF-8');

$sid = trim((string)($_REQUEST['sid'] ?? ''));
$cid = trim((string)($_REQUEST['cid'] ?? ''));
$fid = trim((string)($_REQUEST['fid'] ?? ''));
$action = trim((string)($_POST['action'] ?? ''));

$subscriber = null;
$message = '';

if ($sid !== '') {
    try {
        $stmt = $pdo->prepare("SELECT id, workspace_id, email, first_name, last_name, status FROM subscribers WHERE id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$sid]);
        $subscriber = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

        if ($subscriber && $_SERVER['REQUEST_METHOD'] === 'POST') {
            if ($action === 'resubscribe') {
                $pdo->prepare("UPDATE subscribers SET status = 'active', updated_at = NOW() WHERE id = ?")->execute([$sid]);
                $subscriber['status'] = 'active';
                $message = 'Bạn đã đăng ký nhận lại thông tin qua email thành công.';
            } elseif ($action === 'unsubscribe') {
                $pdo->prepare("UPDATE subscribers SET status = 'unsubscribed', updated_at = NOW() WHERE id = ?")->execute([$sid]);
                $subscriber['status'] = 'unsubscribed';
                $message = 'Bạn đã hủy đăng ký nhận email thành công.';
            }
        }
    } catch (\Throwable $e) {
        error_log("manage_subscription error: " . $e->getMessage());
    }
}

$displayEmail = $subscriber['email'] ?? '';
$isUnsub = ($subscriber && ($subscriber['status'] ?? '') === 'unsubscribed');
$subWsId = (int)($subscriber['workspace_id'] ?? 1);
$subOrg = ($pdo instanceof PDO && class_exists('TenantConfigService'))
    ? TenantConfigService::getOrganizationProfile($pdo, $subWsId > 0 ? $subWsId : 1)
    : [];
$subBrand = trim((string)($subOrg['name'] ?? 'Hệ thống'));
$subHomeUrl = rtrim(trim((string)($subOrg['frontend_url'] ?? resolve_automation_app_base_url($pdo, $subWsId))), '/');
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quản lý đăng ký nhận Email — <?= htmlspecialchars($subBrand, ENT_QUOTES, 'UTF-8') ?></title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
        .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; max-width: 480px; width: 100%; padding: 32px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06); text-align: center; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
        .badge-unsub { background: #fef2f2; color: #bd1d2d; }
        .badge-active { background: #ecfdf5; color: #059669; }
        h1 { font-size: 20px; margin: 0 0 10px; color: #0f172a; }
        p { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px; }
        .email { font-weight: 700; color: #0f172a; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 16px; font-size: 13px; }
        .btn { display: inline-block; border: none; border-radius: 10px; padding: 11px 22px; font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none; }
        .btn-primary { background: #bd1d2d; color: #ffffff; }
        .btn-secondary { background: #e2e8f0; color: #334155; }
        .msg { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <?php if ($message !== ''): ?>
            <div class="msg"><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></div>
        <?php endif; ?>
        <?php if ($subscriber): ?>
            <div class="badge <?= $isUnsub ? 'badge-unsub' : 'badge-active' ?>">
                <?= $isUnsub ? 'Đã hủy đăng ký nhận Email' : 'Đang nhận thông tin Email' ?>
            </div>
            <h1><?= $isUnsub ? 'Hủy đăng ký thành công' : 'Trạng thái đăng ký Email' ?></h1>
            <?php if ($displayEmail !== ''): ?>
                <div class="email"><?= htmlspecialchars($displayEmail, ENT_QUOTES, 'UTF-8') ?></div>
            <?php endif; ?>
            <p>
                <?= $isUnsub
                    ? 'Địa chỉ email của bạn đã được ngừng nhận các bản tin tiếp theo từ ' . htmlspecialchars($subBrand, ENT_QUOTES, 'UTF-8') . '. Nếu bạn bấm nhầm, bạn có thể đăng ký nhận lại ngay bên dưới.'
                    : 'Địa chỉ email của bạn hiện đang ở trạng thái nhận bản tin và thông báo từ ' . htmlspecialchars($subBrand, ENT_QUOTES, 'UTF-8') . '.' ?>
            </p>
            <form method="post">
                <input type="hidden" name="sid" value="<?= htmlspecialchars($sid, ENT_QUOTES, 'UTF-8') ?>">
                <input type="hidden" name="cid" value="<?= htmlspecialchars($cid, ENT_QUOTES, 'UTF-8') ?>">
                <input type="hidden" name="fid" value="<?= htmlspecialchars($fid, ENT_QUOTES, 'UTF-8') ?>">
                <?php if ($isUnsub): ?>
                    <button type="submit" name="action" value="resubscribe" class="btn btn-primary">Đăng ký nhận lại Email</button>
                <?php else: ?>
                    <button type="submit" name="action" value="unsubscribe" class="btn btn-secondary">Hủy đăng ký nhận Email</button>
                <?php endif; ?>
            </form>
        <?php else: ?>
            <h1>Quản lý đăng ký Email</h1>
            <p>Không tìm thấy thông tin người nhận hoặc liên kết không còn hiệu lực.</p>
        <?php endif; ?>
        <?php if ($subHomeUrl !== ''): ?>
        <p style="margin-top: 22px; margin-bottom: 0; font-size: 12px;">
            <a href="<?= htmlspecialchars($subHomeUrl, ENT_QUOTES, 'UTF-8') ?>" style="color: #64748b;">Quay về trang chủ <?= htmlspecialchars($subBrand, ENT_QUOTES, 'UTF-8') ?></a>
        </p>
        <?php endif; ?>
    </div>
</body>
</html>
