-- update for crazy games (Cheez's 2.3M)

ALTER TABLE scores
  ALTER COLUMN pieces TYPE VARCHAR(2400),
  ALTER COLUMN clears TYPE VARCHAR(600);