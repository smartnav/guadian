# Review Widget

## Requirements

When setting up your Google API key, ensure that the callback URL is set to
$URL/auth/google/callback

## Environmental Variables
In `.pam_environment`, you'll need something like this:

```
ENV_DEV=true

# for false, uncomment the following line
#ENV_DEV=

#PORT=80 # this is unprefixed for Dokku's sake

# default: false. this is used so Dokku's port doesn't interfere with our port
# 443 or 80 proxy. This should be set to true on Dokku.
HIDE_PORT=

# for true, uncomment the following line
#HIDE_PORT=true

# Postgres database values

PGPASSWORD=password
PGHOST=host
PGUSER=postgres
PGDATABASE=database
PGPORT=5432
PGPOOLSIZE=10
PROTOCOL=https
DOMAIN=reviews.osmondmarketing.com

# for Postgres versions < 9.4
PGPASS=password


#Google values
GOOGLE_CLIENT_ID=x
GOOGLE_CLIENT_SECRET=x
GOOGLE_CALLBACK_URI=x
# make sure to also enable the Google+ API
GOOGLE_API_KEY=x

# these are used for sending emails
GMAIL_USER=youremail@gmail.com
GMAIL_PASSWORD=gmailpass

SECRET=YourSecretForSessionStorage

# it is recommended to use Twilio's test credentials
# if you are running unit tests
# see https://www.twilio.com/user/account/messaging/dev-tools/test-credentials
TWILIO_SID=X
TWILIO_AUTH_TOKEN=x
# this is the number SMS will be sent from
TWILIO_PHONE_NUMBER=x
```
