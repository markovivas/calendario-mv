<?php

declare(strict_types=1);

date_default_timezone_set('America/Sao_Paulo');

require_once __DIR__ . '/config.php';

function random_id(): string
{
    return bin2hex(random_bytes(5));
}

function h(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function get_settings(): array
{
    $pdo = get_db_connection();
    $settings = [];
    
    try {
        $stmt = $pdo->query('SELECT `key`, value FROM settings');
        while ($row = $stmt->fetch()) {
            $settings[$row['key']] = json_decode($row['value'], true);
        }
    } catch (PDOException $e) {
    }
    
    return $settings;
}

function persist_settings(array $settings): void
{
    $pdo = get_db_connection();
    
    try {
        $pdo->beginTransaction();
        
        $pdo->exec('DELETE FROM settings');
        
        $stmt = $pdo->prepare('INSERT INTO settings (`key`, value) VALUES (?, ?)');
        
        foreach ($settings as $key => $value) {
            $stmt->execute([$key, json_encode($value)]);
        }
        
        $pdo->commit();
    } catch (PDOException $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function get_users(): array
{
    $pdo = get_db_connection();
    $users = [];
    
    try {
        $stmt = $pdo->query('SELECT id, name, username, password_hash FROM users');
        while ($row = $stmt->fetch()) {
            $users[] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'username' => $row['username'],
                'password_hash' => $row['password_hash']
            ];
        }
    } catch (PDOException $e) {
    }
    
    return $users;
}

function save_user(array $user): void
{
    $pdo = get_db_connection();
    $stmt = $pdo->prepare('INSERT INTO users (id, name, username, password_hash) VALUES (?, ?, ?, ?)');
    $stmt->execute([$user['id'], $user['name'], $user['username'], $user['password_hash']]);
}

function get_categories(): array
{
    $pdo = get_db_connection();
    $categories = [];
    
    try {
        $stmt = $pdo->query('SELECT id, name, label, color, `order` FROM categories ORDER BY `order` ASC, id ASC');
        while ($row = $stmt->fetch()) {
            $categories[] = [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'label' => $row['label'],
                'color' => $row['color'],
                'order' => (int) $row['order']
            ];
        }
    } catch (PDOException $e) {
    }
    
    return $categories;
}

function save_category(array $category): bool
{
    $pdo = get_db_connection();
    
    try {
        if (isset($category['id'])) {
            $stmt = $pdo->prepare('UPDATE categories SET name = ?, label = ?, color = ?, `order` = ? WHERE id = ?');
            $stmt->execute([$category['name'], $category['label'], $category['color'], $category['order'], $category['id']]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO categories (name, label, color, `order`) VALUES (?, ?, ?, ?)');
            $stmt->execute([$category['name'], $category['label'], $category['color'], $category['order']]);
        }
        return true;
    } catch (PDOException $e) {
        return false;
    }
}

function delete_category(int $id): bool
{
    $pdo = get_db_connection();
    
    try {
        $stmt = $pdo->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->execute([$id]);
        return true;
    } catch (PDOException $e) {
        return false;
    }
}

function get_events(): array
{
    $pdo = get_db_connection();
    $events = [];
    
    try {
        $stmt = $pdo->query('SELECT id, date, `from`, `to`, title, note, category, owner_id, all_day, `repeat`, series_id, files FROM events ORDER BY date ASC, `from` ASC');
        while ($row = $stmt->fetch()) {
            $filesJson = $row['files'];
            $files = [];
            if ($filesJson) {
                $decoded = json_decode($filesJson, true);
                if (is_array($decoded)) {
                    $files = $decoded;
                }
            }
            
            $events[] = [
                'id' => $row['id'],
                'date' => $row['date'],
                'from' => $row['from'],
                'to' => $row['to'],
                'title' => $row['title'],
                'note' => $row['note'],
                'category' => $row['category'],
                'owner_id' => $row['owner_id'],
                'all_day' => (bool) $row['all_day'],
                'repeat' => $row['repeat'],
                'series_id' => $row['series_id'],
                'files' => $files
            ];
        }
    } catch (PDOException $e) {
    }
    
    return $events;
}

function persist_events(array $events): bool
{
    $pdo = get_db_connection();
    
    try {
        $pdo->beginTransaction();
        
        $pdo->exec('DELETE FROM events');
        
        $stmt = $pdo->prepare('INSERT INTO events (id, date, `from`, `to`, title, note, category, owner_id, all_day, `repeat`, series_id, files) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        
        foreach ($events as $event) {
            $filesJson = isset($event['files']) ? json_encode($event['files']) : null;
            $stmt->execute([
                $event['id'],
                $event['date'],
                $event['from'],
                $event['to'],
                $event['title'],
                $event['note'],
                $event['category'],
                $event['owner_id'],
                $event['all_day'] ? 1 : 0,
                $event['repeat'],
                $event['series_id'],
                $filesJson
            ]);
        }
        
        $pdo->commit();
        return true;
    } catch (PDOException $e) {
        error_log('Erro no persist_events: ' . $e->getMessage());
        $pdo->rollBack();
        return false;
    }
}

function normalize_all_day(array $event): bool
{
    return !empty($event['all_day']);
}

function handle_file_upload(string $date): array
{
    $uploadedFiles = [];
    
    if (!isset($_FILES['files'])) {
        return $uploadedFiles;
    }
    
    $files = $_FILES['files'];
    $fileCount = is_array($files['name']) ? count($files['name']) : 0;
    
    if ($fileCount === 0) {
        return $uploadedFiles;
    }
    
    $uploadDir = __DIR__ . '/uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $dateObj = DateTime::createFromFormat('Y-m-d', $date);
    $formattedDate = $dateObj ? $dateObj->format('d-m-Y') : date('d-m-Y');
    
    for ($i = 0; $i < $fileCount; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) {
            continue;
        }
        
        $originalName = pathinfo($files['name'][$i], PATHINFO_FILENAME);
        $extension = pathinfo($files['name'][$i], PATHINFO_EXTENSION);
        
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '-', $originalName);
        $fileName = $formattedDate . '-' . $safeName;
        if ($extension) {
            $fileName .= '.' . $extension;
        }
        
        $counter = 1;
        while (file_exists($uploadDir . $fileName)) {
            $fileName = $formattedDate . '-' . $safeName . '-' . $counter;
            if ($extension) {
                $fileName .= '.' . $extension;
            }
            $counter++;
        }
        
        if (move_uploaded_file($files['tmp_name'][$i], $uploadDir . $fileName)) {
            $uploadedFiles[] = $fileName;
        }
    }
    
    return $uploadedFiles;
}

function build_event_from_request(string $id, string $ownerId, ?array $existingFiles = null): array
{
    $allDay = ($_POST['all_day'] ?? '0') === '1';
    $date = trim((string) ($_POST['date'] ?? ''));
    $from = $allDay ? '00:00' : trim((string) ($_POST['from'] ?? '09:00'));
    $to = $allDay ? '23:59' : trim((string) ($_POST['to'] ?? '10:00'));
    
    $newFiles = handle_file_upload($date);
    $existingFilesList = is_array($existingFiles) ? $existingFiles : [];
    
    $keepExistingFiles = isset($_POST['keep_files']) ? json_decode($_POST['keep_files'], true) : [];
    $keptFiles = [];
    if (is_array($keepExistingFiles)) {
        foreach ($keepExistingFiles as $fileName) {
            if (in_array($fileName, $existingFilesList)) {
                $keptFiles[] = $fileName;
            }
        }
    }
    
    $files = array_merge($keptFiles, $newFiles);

    return [
        'id' => $id,
        'date' => $date,
        'from' => $from,
        'to' => $to,
        'title' => trim((string) ($_POST['title'] ?? '')),
        'note' => trim((string) ($_POST['note'] ?? '')),
        'category' => trim((string) ($_POST['category'] ?? 'pessoal')),
        'owner_id' => $ownerId,
        'all_day' => $allDay,
        'repeat' => trim((string) ($_POST['repeat'] ?? 'none')),
        'series_id' => trim((string) ($_POST['series_id'] ?? '')),
        'files' => $files,
    ];
}

function create_recurring_events(array $baseEvent, int $occurrences): array
{
    $occurrences = max(1, min($occurrences, 24));
    $repeat = $baseEvent['repeat'] ?? 'none';

    if ($repeat === 'none' || $occurrences === 1) {
        return [$baseEvent];
    }

    $seriesId = random_id();
    $items = [];
    $date = new DateTimeImmutable($baseEvent['date']);

    for ($i = 0; $i < $occurrences; $i++) {
        $event = $baseEvent;
        $event['id'] = random_id();
        $event['series_id'] = $seriesId;
        $event['date'] = $date->format('Y-m-d');
        $items[] = $event;

        if ($repeat === 'daily') {
            $date = $date->modify('+1 day');
        } elseif ($repeat === 'weekly') {
            $date = $date->modify('+1 week');
        } elseif ($repeat === 'monthly') {
            $date = $date->modify('+1 month');
        }
    }

    return $items;
}

$settings = get_settings();
if (!isset($settings['calendar_id'])) {
    $settings['calendar_id'] = random_id();
    $settings['title'] = 'Meu Calendário';
    persist_settings($settings);
}

$users = get_users();

session_name("PHPSESSID_{$settings['calendar_id']}");
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$action = $_GET['action'] ?? null;

if ($action) {
    if (!isset($_SESSION['user_id'])) {
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }

    if ($action === 'list_categories') {
        $categories = get_categories();
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($categories);
        exit;
    }

    if ($action === 'save_category') {
        $category = [
            'name' => trim((string) ($_POST['name'] ?? '')),
            'label' => trim((string) ($_POST['label'] ?? '')),
            'color' => trim((string) ($_POST['color'] ?? '#6366f1')),
            'order' => (int) ($_POST['order'] ?? 0)
        ];
        
        if (isset($_POST['id']) && $_POST['id'] !== '') {
            $category['id'] = (int) $_POST['id'];
        }
        
        $success = save_category($category);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => $success]);
        exit;
    }

    if ($action === 'delete_category') {
        $id = (int) ($_POST['id'] ?? 0);
        $success = delete_category($id);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => $success]);
        exit;
    }

    $events = get_events();

    if ($action === 'list') {
        $fcEvents = [];
        foreach ($events as $event) {
            $allDay = normalize_all_day($event);
            $fcEvent = [
                'id' => $event['id'],
                'title' => $event['title'] !== '' ? $event['title'] : 'Sem título',
                'start' => $allDay ? $event['date'] : $event['date'] . 'T' . $event['from'],
                'allDay' => $allDay,
                'className' => 'cat-' . ($event['category'] ?? 'pessoal'),
                'extendedProps' => [
                    'note' => $event['note'] ?? '',
                    'date' => $event['date'],
                    'from' => $event['from'],
                    'to' => $event['to'],
                    'title' => $event['title'] ?? '',
                    'category' => $event['category'] ?? 'pessoal',
                    'repeat' => $event['repeat'] ?? 'none',
                    'series_id' => $event['series_id'] ?? '',
                    'all_day' => $allDay,
                    'owner_id' => $event['owner_id'] ?? '',
                    'files' => $event['files'] ?? [],
                ],
            ];

            if (!$allDay) {
                $fcEvent['end'] = $event['date'] . 'T' . $event['to'];
            }

            $fcEvents[] = $fcEvent;
        }

        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($fcEvents);
        exit;
    }

    if ($action === 'create' || $action === 'update') {
        $id = trim((string) ($_POST['id'] ?? ''));
        $id = $id !== '' ? $id : random_id();
        
        $existingFiles = [];
        if ($action === 'update') {
            foreach ($events as $event) {
                if ($event['id'] === $id) {
                    $existingFiles = $event['files'] ?? [];
                    break;
                }
            }
        }
        
        $newEvent = build_event_from_request($id, $_SESSION['user_id'], $existingFiles);

        if ($action === 'update') {
            $found = false;
            foreach ($events as $index => $event) {
                if ($event['id'] === $id) {
                    $newEvent['series_id'] = $event['series_id'] ?? '';
                    $events[$index] = $newEvent;
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode(['success' => false, 'message' => 'Evento não encontrado para atualização.']);
                exit;
            }
        } else {
            $occurrences = (int) ($_POST['occurrences'] ?? 1);
            $events = array_merge($events, create_recurring_events($newEvent, $occurrences));
        }

        $success = persist_events(array_values($events));
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => $success, 'message' => $success ? '' : 'Falha ao gravar no banco de dados.']);
        exit;
    }

    if ($action === 'delete') {
        $id = trim((string) ($_GET['id'] ?? $_POST['id'] ?? ''));
        $events = array_filter($events, static fn(array $event): bool => $event['id'] !== $id);
        $success = persist_events(array_values($events));
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => $success, 'message' => $success ? '' : 'Falha ao gravar no banco de dados.']);
        exit;
    }
}

if (isset($_SESSION['user_id']) && !isset($_SESSION['user_name'])) {
    foreach ($users as $user) {
        if ($user['id'] === $_SESSION['user_id']) {
            $_SESSION['user_name'] = $user['name'];
            break;
        }
    }
}

if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ./');
    exit;
}

if (isset($_GET['register'])) {
    $name = trim((string) ($_POST['name'] ?? ''));
    $username = strtolower(trim((string) ($_POST['username'] ?? '')));
    $password = (string) ($_POST['password'] ?? '');

    if ($name === '' || $username === '' || $password === '') {
        $error = 'Todos os campos são obrigatórios.';
    } else {
        $users = get_users();
        
        $exists = false;
        foreach ($users as $u) {
            if ($u['username'] === $username) {
                $exists = true;
                break;
            }
        }

        if ($exists) {
            $error = 'Este nome de usuário já está em uso.';
        } else {
            $newUser = [
                'id' => random_id(),
                'name' => $name,
                'username' => $username,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ];
            save_user($newUser);
            
            // Auto login
            $_SESSION['user_id'] = $newUser['id'];
            $_SESSION['user_name'] = $newUser['name'];
            header('Location: ./');
            exit;
        }
    }
}

if (isset($_GET['login'])) {
    $users = get_users();
    foreach ($users as $user) {
        if (
            strtolower((string) ($_POST['username'] ?? '')) === strtolower($user['username'])
            && password_verify((string) ($_POST['password'] ?? ''), $user['password_hash'])
        ) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_name'] = $user['name'];
            header('Location: ./');
            exit;
        }
    }
    $error = 'Usuário ou senha inválidos.';
}

if (!isset($_SESSION['user_id'])) {
    ?>
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - <?= h($settings['title'] ?? 'Calendário') ?></title>
        <link rel="stylesheet" href="styles.css">
    </head>
    <body class="login-page">
        <div class="login-shell">
            <div class="login-card">
                <div class="login-brand">
                    <img src="logo/logo.png" alt="Logo" class="login-logo">
                </div>
                <p class="login-copy">Entre para abrir sua agenda ou crie uma conta nova agora mesmo.</p>
                <?php if (isset($error)) : ?>
                    <div class="login-error"><?= h($error) ?></div>
                <?php endif; ?>
                
                <div id="login-form-container">
                    <form action="?login" method="post" class="login-form">
                        <label>
                            <span>Usuário</span>
                            <input type="text" name="username" placeholder="Seu usuário" required autofocus>
                        </label>
                        <label>
                            <span>Senha</span>
                            <input type="password" name="password" placeholder="Sua senha" required>
                        </label>
                        <button type="submit" class="primary-button">Entrar</button>
                        <button type="button" class="text-button" onclick="toggleAuth('register')">Não tem conta? Cadastre-se</button>
                    </form>
                </div>

                <div id="register-form-container" style="display: none;">
                    <form action="?register" method="post" class="login-form">
                        <label>
                            <span>Nome completo</span>
                            <input type="text" name="name" placeholder="Como quer ser chamado?" required>
                        </label>
                        <label>
                            <span>Usuário</span>
                            <input type="text" name="username" placeholder="Escolha um usuário" required>
                        </label>
                        <label>
                            <span>Senha</span>
                            <input type="password" name="password" placeholder="Crie uma senha" required>
                        </label>
                        <button type="submit" class="primary-button">Criar conta</button>
                        <button type="button" class="text-button" onclick="toggleAuth('login')">Já tem conta? Faça login</button>
                    </form>
                </div>

                <script>
                    function toggleAuth(mode) {
                        const loginContainer = document.getElementById('login-form-container');
                        const registerContainer = document.getElementById('register-form-container');
                        
                        if (mode === 'register') {
                            loginContainer.style.display = 'none';
                            registerContainer.style.display = 'block';
                        } else {
                            loginContainer.style.display = 'block';
                            registerContainer.style.display = 'none';
                        }
                    }
                </script>
            </div>
        </div>
    </body>
    </html>
    <?php
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= h($settings['title'] ?? 'Calendário') ?></title>
    <link rel="stylesheet" href="styles.css">
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>
    <script src="scripts.js" defer></script>
</head>
<body>
    <div class="app-shell">
        <header class="topbar">
            <div class="brand-cluster">
                <button class="icon-button mobile-only" id="sidebar-toggle" type="button" aria-label="Abrir menu">☰</button>
                <img class="brand-logo" src="logo/logo.png" alt="<?= h($settings['title'] ?? 'CalendÃ¡rio') ?>">
                <div class="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/></svg>
                </div>
                <div>
                    <p class="eyebrow">Painel</p>
                    <h1><?= h($settings['title'] ?? 'Calendário') ?></h1>
                </div>
            </div>

            <div class="nav-cluster">
                <button class="secondary-button" id="btn-today" type="button">Hoje</button>
                <div class="nav-arrows">
                    <button class="icon-button" id="btn-prev" type="button" title="Anterior" aria-label="Anterior">‹</button>
                    <button class="icon-button" id="btn-next" type="button" title="Próximo" aria-label="Próximo">›</button>
                </div>
                <h2 class="current-date" id="current-date"></h2>
            </div>

            <div class="actions-cluster">
                <label class="search-box">
                    <span class="search-box__icon">⌕</span>
                    <input type="text" id="search-input" placeholder="Buscar por título ou nota">
                </label>

                <select id="view-selector" class="select-control" aria-label="Selecionar visão">
                    <option value="dayGridMonth">Mês</option>
                    <option value="timeGridWeek">Semana</option>
                    <option value="timeGridDay">Dia</option>
                    <option value="listMonth">Agenda</option>
                </select>

                <div class="user-chip">
                    <span><?= h($_SESSION['user_name'] ?? 'Usuário') ?></span>
                    <button type="button" id="btn-settings" class="icon-button" aria-label="Configurações" title="Configurações">⚙️</button>
                    <a href="?logout">Sair</a>
                </div>
            </div>
        </header>

        <div class="main-layout">
            <aside class="sidebar" id="sidebar">
                <button class="create-button" id="btn-create" type="button">
                    <span class="create-button__plus">+</span>
                    <span>Novo evento</span>
                </button>

                <section class="sidebar-card mini-calendar-card">
                    <div class="sidebar-card__header">
                        <h3>Mini calendário</h3>
                        <p>Salte para qualquer dia.</p>
                    </div>
                    <div class="mini-calendar" id="mini-calendar"></div>
                </section>

                <section class="sidebar-card">
                    <div class="sidebar-card__header">
                        <h3>Filtros</h3>
                        <button type="button" id="btn-clear-filters" class="text-button">Limpar</button>
                    </div>
                    <div class="filter-stack">
                        <label class="filter-option">
                            <input type="checkbox" value="pessoal" class="category-filter" checked>
                            <span class="legend-dot pessoal"></span>
                            <span>Pessoal</span>
                        </label>
                        <label class="filter-option">
                            <input type="checkbox" value="trabalho" class="category-filter" checked>
                            <span class="legend-dot trabalho"></span>
                            <span>Trabalho</span>
                        </label>
                        <label class="filter-option">
                            <input type="checkbox" value="urgente" class="category-filter" checked>
                            <span class="legend-dot urgente"></span>
                            <span>Urgente</span>
                        </label>
                    </div>
                </section>

                <section class="sidebar-card">
                    <div class="sidebar-card__header">
                        <h3>Atalhos</h3>
                        <p>Toques rápidos para o dia a dia.</p>
                    </div>
                    <ul class="shortcut-list">
                        <li><kbd>N</kbd> novo evento</li>
                        <li><kbd>/</kbd> focar busca</li>
                        <li><kbd>Esc</kbd> fechar modal</li>
                    </ul>
                </section>
            </aside>

            <main class="workspace">
                <section class="workspace-toolbar">
                    <div class="legend-row">
                        <button type="button" class="legend-chip active" data-category="pessoal">
                            <span class="legend-dot pessoal"></span>Pessoal
                        </button>
                        <button type="button" class="legend-chip active" data-category="trabalho">
                            <span class="legend-dot trabalho"></span>Trabalho
                        </button>
                        <button type="button" class="legend-chip active" data-category="urgente">
                            <span class="legend-dot urgente"></span>Urgente
                        </button>
                    </div>
                    <div class="range-fields">
                        <label>
                            <span>De</span>
                            <input type="date" id="filter-start">
                        </label>
                        <label>
                            <span>Até</span>
                            <input type="date" id="filter-end">
                        </label>
                    </div>
                </section>

                <section class="calendar-card">
                    <div class="calendar-card__top">
                        <div>
                            <p class="eyebrow">Sua agenda</p>
                            <h3>Compromissos organizados por contexto</h3>
                        </div>
                        <div id="status-message" class="status-message" aria-live="polite"></div>
                    </div>
                    <div id="calendar-container"></div>
                </section>
            </main>
        </div>
    </div>

    <div id="event-tooltip" class="event-tooltip" hidden></div>

    <div id="event-modal" class="modal" aria-hidden="true">
        <div class="modal-dialog">
            <form id="event-form" class="event-form" enctype="multipart/form-data">
                <input type="hidden" name="id" id="modal-id">
                <input type="hidden" name="series_id" id="modal-series-id">
                <input type="hidden" name="keep_files" id="modal-keep-files">

                <div class="modal-header">
                    <div>
                        <p class="eyebrow" id="modal-eyebrow">Novo compromisso</p>
                        <input type="text" name="title" id="modal-title" class="event-title-input" placeholder="Adicionar título">
                    </div>
                    <button type="button" class="icon-button" id="btn-close-modal" aria-label="Fechar modal">×</button>
                </div>

                <div class="modal-grid">
                    <label class="field">
                        <span>Data</span>
                        <input type="date" name="date" id="modal-date" required>
                    </label>

                    <label class="field checkbox-field">
                        <input type="checkbox" id="modal-all-day">
                        <span>Dia inteiro</span>
                    </label>

                    <label class="field time-field" id="field-from">
                        <span>Das</span>
                        <input type="time" name="from" id="modal-from" required>
                    </label>

                    <label class="field time-field" id="field-to">
                        <span>Até</span>
                        <input type="time" name="to" id="modal-to" required>
                    </label>

                    <label class="field">
                        <span>Categoria</span>
                        <select name="category" id="modal-category">
                            <option value="pessoal">Pessoal</option>
                            <option value="trabalho">Trabalho</option>
                            <option value="urgente">Urgente</option>
                        </select>
                    </label>

                    <label class="field">
                        <span>Repetição</span>
                        <select name="repeat" id="modal-repeat">
                            <option value="none">Não repetir</option>
                            <option value="daily">Diariamente</option>
                            <option value="weekly">Semanalmente</option>
                            <option value="monthly">Mensalmente</option>
                        </select>
                    </label>

                    <label class="field" id="field-occurrences">
                        <span>Ocorrências</span>
                        <input type="number" name="occurrences" id="modal-occurrences" min="1" max="24" value="1">
                    </label>

                    <label class="field full-width">
                        <span>Nota</span>
                        <textarea name="note" id="modal-note" rows="4" placeholder="Detalhes, links ou observações"></textarea>
                    </label>
                    
                    <label class="field full-width">
                        <span>Anexar arquivos</span>
                        <div class="file-upload-container">
                            <input type="file" name="files[]" id="modal-file" multiple class="file-input">
                            <div class="file-upload-label">
                                <span class="upload-icon">📎</span>
                                <span class="upload-text">Clique para selecionar ou arraste os arquivos</span>
                            </div>
                        </div>
                        <div class="file-list" id="file-list"></div>
                    </label>
                </div>

                <div id="conflict-warning" class="inline-warning" hidden></div>

                <div class="modal-footer">
                    <button type="button" class="text-button danger" id="btn-delete">Excluir</button>
                    <button type="button" class="text-button" id="btn-duplicate">Duplicar</button>
                    <button type="button" class="text-button" id="btn-cancel">Cancelar</button>
                    <button type="submit" class="primary-button">Salvar</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal de Configurações -->
    <div id="settings-modal" class="modal" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-header">
                <div>
                    <p class="eyebrow">Configurações</p>
                    <h2>Gerenciar Categorias</h2>
                </div>
                <button type="button" class="icon-button" id="btn-close-settings" aria-label="Fechar">×</button>
            </div>
            
            <div class="modal-content">
                <div id="categories-list" class="categories-list"></div>
                
                <div class="category-form-container">
                    <h3 id="category-form-title">Nova Categoria</h3>
                    <form id="category-form" class="category-form">
                        <input type="hidden" name="id" id="category-id">
                        
                        <label class="field">
                            <span>Nome (slug)</span>
                            <input type="text" name="name" id="category-name" required placeholder="ex: reuniao">
                        </label>
                        
                        <label class="field">
                            <span>Rótulo</span>
                            <input type="text" name="label" id="category-label" required placeholder="ex: Reunião">
                        </label>
                        
                        <label class="field">
                            <span>Cor</span>
                            <input type="color" name="color" id="category-color" value="#6366f1">
                        </label>
                        
                        <label class="field">
                            <span>Ordem</span>
                            <input type="number" name="order" id="category-order" min="0" value="0">
                        </label>
                        
                        <div class="modal-footer">
                            <button type="button" class="text-button" id="btn-cancel-category">Cancelar</button>
                            <button type="submit" class="primary-button">Salvar Categoria</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</body>
</html>

