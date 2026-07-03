-- CreateTable: GitLab Integration Models

CREATE TABLE "gitlab_connections" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "gitlab_user_id" INTEGER NOT NULL,
    "gitlab_username" VARCHAR(255) NOT NULL,
    "gitlab_email" VARCHAR(255),
    "access_token" TEXT NOT NULL,
    "token_scopes" VARCHAR(500),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gitlab_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gitlab_repositories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" UUID NOT NULL,
    "gitlab_project_id" INTEGER NOT NULL,
    "connected_by_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "full_path" VARCHAR(500) NOT NULL,
    "default_branch" VARCHAR(255) NOT NULL DEFAULT 'main',
    "web_url" VARCHAR(500),
    "webhook_id" INTEGER,
    "webhook_secret" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gitlab_repositories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gitlab_commits" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "sha" VARCHAR(40) NOT NULL,
    "message" TEXT NOT NULL,
    "author_name" VARCHAR(255),
    "author_email" VARCHAR(255),
    "committed_at" TIMESTAMP(3) NOT NULL,
    "web_url" VARCHAR(500),
    "branch" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gitlab_commits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gitlab_branches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID,
    "repository_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "web_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gitlab_branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gitlab_merge_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "issue_id" UUID NOT NULL,
    "repository_id" UUID NOT NULL,
    "mr_iid" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "source_branch" VARCHAR(255),
    "target_branch" VARCHAR(255),
    "author_name" VARCHAR(255),
    "web_url" VARCHAR(500),
    "merged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gitlab_merge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_connections_user_id_key" ON "gitlab_connections"("user_id");
CREATE INDEX "gitlab_connections_user_id_idx" ON "gitlab_connections"("user_id");

CREATE UNIQUE INDEX "gitlab_repositories_project_id_key" ON "gitlab_repositories"("project_id");
CREATE INDEX "gitlab_repositories_project_id_idx" ON "gitlab_repositories"("project_id");
CREATE INDEX "gitlab_repositories_gitlab_project_id_idx" ON "gitlab_repositories"("gitlab_project_id");

CREATE UNIQUE INDEX "gitlab_commits_repository_id_sha_key" ON "gitlab_commits"("repository_id", "sha");
CREATE INDEX "gitlab_commits_issue_id_idx" ON "gitlab_commits"("issue_id");
CREATE INDEX "gitlab_commits_repository_id_idx" ON "gitlab_commits"("repository_id");
CREATE INDEX "gitlab_commits_committed_at_idx" ON "gitlab_commits"("committed_at");

CREATE UNIQUE INDEX "gitlab_branches_repository_id_name_key" ON "gitlab_branches"("repository_id", "name");
CREATE INDEX "gitlab_branches_issue_id_idx" ON "gitlab_branches"("issue_id");
CREATE INDEX "gitlab_branches_repository_id_idx" ON "gitlab_branches"("repository_id");

CREATE UNIQUE INDEX "gitlab_merge_requests_repository_id_mr_iid_key" ON "gitlab_merge_requests"("repository_id", "mr_iid");
CREATE INDEX "gitlab_merge_requests_issue_id_idx" ON "gitlab_merge_requests"("issue_id");
CREATE INDEX "gitlab_merge_requests_repository_id_idx" ON "gitlab_merge_requests"("repository_id");
CREATE INDEX "gitlab_merge_requests_state_idx" ON "gitlab_merge_requests"("state");

-- AddForeignKey
ALTER TABLE "gitlab_connections" ADD CONSTRAINT "gitlab_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gitlab_repositories" ADD CONSTRAINT "gitlab_repositories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gitlab_commits" ADD CONSTRAINT "gitlab_commits_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gitlab_commits" ADD CONSTRAINT "gitlab_commits_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "gitlab_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gitlab_branches" ADD CONSTRAINT "gitlab_branches_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gitlab_branches" ADD CONSTRAINT "gitlab_branches_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "gitlab_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gitlab_merge_requests" ADD CONSTRAINT "gitlab_merge_requests_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gitlab_merge_requests" ADD CONSTRAINT "gitlab_merge_requests_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "gitlab_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
