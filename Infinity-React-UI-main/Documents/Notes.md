Notes

.env Testing
cheap&reasoning=false = gpt-3.5
cheap&reasoning=true = gpt-4
accurate&reasoning=false = gpt-3.5
accurate&reasoning=false = gpt-4
cheap&preview=true = gpt-4

Non-Prod Setup when Infinity Assistant gets an Unauthorized Access Message.

Step 1. Go to https://api.horizon.elevancehealth.com/swagger#tag/authentication/POST/v2/oauth2/token
Step 2. Select Test Request in the Generate authorization token
Step 3. Add the below client_id and client secret in the post request

{
  "client_id": "piI7ubfBnm6SnZecRZ2KGeUeXOZVXRGS",
  "client_secret": "3e36962c45464a9a83ca09e439cfe62e",
  "grant_type": "client_credentials"
}

Step 4: A token will be generated. Add the token to the .env file in the Project.
Step 5: restart backend and front end server
