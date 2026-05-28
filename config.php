<?php

declare(strict_types=1);

/**
 * Configurações de conexão com o banco de dados MySQL (Docker)
 */
define('DB_HOST', 'localhost');
define('DB_NAME', 'mar05692_marcovivas');
define('DB_USER', 'mar05692_marco');
define('DB_PASS', 'Site@1989');

/**
 * Função para obter conexão com o banco de dados
 * @return PDO
 */
function get_db_connection(): PDO
{
    static $pdo = null;
    
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            die('Erro na conexão com o banco de dados: ' . $e->getMessage());
        }
    }
    
    return $pdo;
}
