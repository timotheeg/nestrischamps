# Run in a docker container

This was an exercising in learning how to docker.  There's plenty of opportunity for improvement.  Tabling for now.  


## Environment variables

These can be exported to the environment or defined in a file.  If `.env` is used as the file, `docker compose` will load the variables automatically.
If any other file is used, it can be specified with `--env-file`.  


### Save game frames

This variable is passed through.  The NTC_ prefix is added to distinguish it as a variable for the container, not the app directly.  

```
NTC_FF_SAVE_GAME_FRAMES=1
```

### User ID & Group ID

To follow best practices, the services are configured to run as a non-root user.  The official images for postgres and node come built in with non-root users named after the image.  The default UID/GID for postgres is 999 and for node is 1000.  This will normalize both of them to be the same user & group ID.


```
NTC_UID=1000
NTC_GID=1000
```

### Mount points

These directories should exist and be writable by the User ID & Group ID defined above.  
For windows, use `/c/path/to/resource`


```
NTC_GAMES_PATH=/path/to/games
NTC_DB_PATH=/path/to/db
```

### Database Info
These values are passed to the db container to instantiate the database with these values as well as to the web container to 
make use of them to connect to the database.


```
NTC_POSTGRES_USER=dbuser
NTC_POSTGRES_PASSWORD=tetrisrocks
NTC_POSTGRES_DB=tetrisdb
```


## Run image

### Run normally

If the environment variables have been exported, or if `.env` is defined with the necessary variables:

`docker compose up`


### Run with separate environment file

If the environment variables are defined in a file other than `.env`, for example `ntc-vars.env`:

`docker compose up --env-file ntc-vars.env`



### Run web only

If an instance of postgresql already exists, the db instance does not need to be run.  

Set an additional environment (or add to .env file) called `NTC_POSTGRES_HOST`

Example:
```
NTC_POSTGRES_HOST=172.16.42.42
```

Note:  The environment variable `NTC_DB_PATH` is still necessary to be defined as it can't be blank.  The value will be ignored so it can be set to any path.

`docker compose up web`


