DROP TABLE IF EXISTS "nonces" CASCADE;
DROP TABLE IF EXISTS "forms" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "audit_log" CASCADE;
DROP TABLE IF EXISTS "responses" CASCADE;
DROP TABLE IF EXISTS "responders" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TYPE IF EXISTS visit CASCADE;
DROP TYPE IF EXISTS E_STATUS_FORMS CASCADE;
DROP TYPE IF EXISTS E_STATUS_RESPONSES CASCADE;
DROP TYPE IF EXISTS E_TYPE CASCADE;

CREATE TYPE visit AS ENUM('standard', 'shortStay');
CREATE TYPE E_STATUS_FORMS AS ENUM ('published', 'unpublished', 'trashed');
CREATE TYPE E_STATUS_RESPONSES AS ENUM ('approved', 'unapproved', 'trashed');
CREATE TYPE E_TYPE AS ENUM ('text', 'range');

CREATE TABLE "users" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  -- Limit names to 25 characters
  "name" varchar(25) NULL DEFAULT null,
  "email" varchar(255) NULL DEFAULT null,
  --handles global permissions (admins)
  "type" varchar(25) NULL DEFAULT 'user',
   -- varchar 254 might be excessively large
  "access_token" varchar(255) NULL DEFAULT null
);

CREATE TABLE "forms" (
  -- UUID instead of an integer for the sake of mitigating randomly-generated
  -- attacks towards all our forms
  "id" UUID NOT NULL PRIMARY KEY,
  "type" visit NOT NULL DEFAULT 'standard',
  "facility" varchar(255) NULL,
  "yelp" varchar(255) NULL,
  "google_plus" varchar(255) NULL,
  "allowed_origins" TEXT[] NULL DEFAULT NULL,
  "redirect_url" TEXT NULL DEFAULT NULL,
  "owner_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "status" E_STATUS_FORMS DEFAULT 'published',
  "created" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE "questions" (
  "id" UUID NOT NULL PRIMARY KEY,
  "formid" UUID NOT NULL REFERENCES "forms"("id"),
  "orderid" int NULL,
  "type" E_TYPE NULL DEFAULT 'text',
  "question" TEXT NULL DEFAULT 'question',
  "is_hide" BOOLEAN NULL DEFAULT false
);

CREATE TABLE "responders" (
  "id" UUID NOT NULL PRIMARY KEY,
  "formid" UUID NOT NULL REFERENCES "forms"("id"),
  
   -- submitter info --
  "name" VARCHAR(255) NULL DEFAULT NULL,
  "email" VARCHAR(255) NULL DEFAULT NULL,
  -- see http://www.itu.int/ITU-T/recommendations/rec.aspx?rec=E.164
  "phone" VARCHAR(20) NULL DEFAULT NULL,
  "ip" CIDR NOT NULL,
  "status" E_STATUS_RESPONSES DEFAULT 'unapproved',
  "created" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  "contacted_status" int NOT NULL DEFAULT 0

 );

CREATE TABLE "responses" (
  --"formid" UUID NOT NULL REFERENCES "forms"("id"),      -- Do we need this? Probably so, so we can pull responses out.
  "questionid" UUID NOT NULL REFERENCES "questions"("id"),
  "responderid" UUID NOT NULL REFERENCES "responders"("id"),
  "textval" TEXT NULL DEFAULT NULL,
  "rateval" SMALLINT NULL DEFAULT NULL CHECK (rateval >= 1 AND rateval <= 5)
);


CREATE TABLE "nonces" (
  "value" BYTEA NOT NULL PRIMARY KEY,
  "formid" UUID NOT NULL REFERENCES "forms"("id"),
  "created" TIMESTAMP without time zone default now(),
  "expires" TIMESTAMP without time zone NOT NULL default now()
    + interval '1 hour'
);

CREATE TABLE "audit_log" (
"model" varchar(100) NULL,
"operation" varchar(100) NULL,
"pkey" varchar(100) NULL,
"user_id" int NULL,
"details" varchar(500) NULL,
"log_time" TIMESTAMP without time zone default now()
);


CREATE INDEX ON "responders"("status");
CREATE INDEX ON "forms"("status");
