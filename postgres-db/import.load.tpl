LOAD DATABASE
     FROM sqlite:///app/database-sql-lite.db
     INTO postgresql://{{ POSTGRES_USER }}:{{ POSTGRES_PASSWORD }}@localhost:5432/{{ POSTGRES_DB }}

CAST
     type datetime to timestamptz using (lambda (x) (unix-timestamp-to-timestamptz (if x (floor x 1000)))),
     type timestamp to timestamptz using (lambda (x) (unix-timestamp-to-timestamptz (if x (floor x 1000)))),
     type integer to integer,
     type varchar to varchar,
     type text to text

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512MB';
