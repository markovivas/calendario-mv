# Calendário MV — Gerenciamento de Eventos

Sistema de calendário web multi-usuário com gerenciamento de eventos, categorias, arquivos anexos e eventos recorrentes. Interface moderna com efeito glassmorphism e design responsivo.

## Funcionalidades

- **Autenticação** — Cadastro e login de usuários com senhas hasheadas (bcrypt)
- **CRUD de eventos** — Criar, editar, excluir e duplicar eventos via modal
- **Arrastar e redimensionar** — Eventos ajustáveis por drag-and-drop e resize
- **Categorias personalizáveis** — Cores, nomes e etiquetas configuráveis
- **Eventos recorrentes** — Repetição diária, semanal ou mensal (até 24 ocorrências)
- **Anexos** — Upload de múltiplos arquivos por evento com preview por extensão
- **Pesquisa e filtros** — Busca textual, filtro por categoria e intervalo de datas
- **Detecção de conflitos** — Alerta de eventos sobrepostos no mesmo horário
- **Mini calendário** — Navegação rápida entre datas na barra lateral
- **Atalhos de teclado** — `N` novo evento, `/` buscar, `Esc` fechar
- **4 visualizações** — Mês, Semana, Dia e Lista
- **Design responsivo** — Adaptável a desktops, tablets e celulares

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Backend | PHP 8+ (PDO, `strict_types`) |
| Banco | MySQL / MariaDB |
| Frontend | JavaScript Vanilla, CSS3 |
| Calendário | FullCalendar 6.1.11 (CDN) |
| Ícones | Font Awesome 6 (CDN) |

## Requisitos

- PHP 8.0 ou superior
- MySQL 5.7+ ou MariaDB 10.2+
- Extensão PDO MySQL habilitada
- Servidor web (Apache, Nginx, etc.)

## Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/usuario/calendario-mv.git
   ```

2. Importe o banco de dados:
   ```bash
   mysql -u usuario -p banco < database.sql
   ```

3. Configure a conexão em `config.php`:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'seu_banco');
   define('DB_USER', 'seu_usuario');
   define('DB_PASS', 'sua_senha');
   ```

4. Aponte o servidor web para a raiz do projeto.

5. Acesse no navegador e cadastre-se.

> O diretório `uploads/` é criado automaticamente para os anexos.

## Estrutura

```
├── index.php        # Roteador principal (autenticação, API, HTML)
├── config.php       # Configuração do banco de dados
├── scripts.js       # Lógica JavaScript do cliente
├── styles.css       # Folha de estilos completa
├── database.sql     # Schema do banco MySQL
├── favicon.svg      # Ícone do calendário
├── logo/logo.png    # Logotipo da aplicação
└── uploads/         # Arquivos anexados (criado automaticamente)
```

## Banco de Dados

O schema contém 4 tabelas:

- `users` — Usuários cadastrados
- `categories` — Categorias de eventos (3 padrões: Pessoal, Trabalho, Urgente)
- `events` — Eventos com suporte a repetição e anexos
- `settings` — Configurações gerais do calendário

## Licença

Este projeto é de uso livre.
