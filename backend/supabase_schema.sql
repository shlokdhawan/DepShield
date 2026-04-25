-- Supabase Schema for DepShield

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    login TEXT NOT NULL,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    access_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE github_installations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    installation_id BIGINT UNIQUE NOT NULL,
    account_login TEXT,
    account_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    installation_id BIGINT REFERENCES github_installations(installation_id) ON DELETE CASCADE,
    github_repo_id BIGINT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    name TEXT,
    owner TEXT,
    default_branch TEXT,
    private BOOLEAN,
    enabled BOOLEAN DEFAULT TRUE,
    last_scan_at TIMESTAMPTZ,
    last_scan_grade TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_full_name TEXT NOT NULL,
    commit_sha TEXT,
    commit_timestamp TIMESTAMPTZ,
    triggered_by TEXT DEFAULT 'webhook',
    grade TEXT,
    risk_score INT,
    total_deps INT,
    critical INT,
    high INT,
    result_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT,
    delivery_id TEXT,
    repository TEXT,
    payload_summary TEXT,
    received_at TIMESTAMPTZ,
    logged_at TIMESTAMPTZ DEFAULT NOW()
);
