contrat d'API : 

GET /musics
query strings : ?page=number
return CSV text + "Next-Page" & "Total-Page" headers (both numbers)

POST /musics
body : audio file as binary content
header : content-type or Content-Type is required and must match mime-type detected from file !
return JSON with ID of music + tags and page number where this music was saved

GET /musics/{id}
return all metadata of the file in JSON format

GET /musics/{id}/download
query string : ?base64=true|false (false by default)    ?include-metadata=true|false (false by default, if true add metadata of file in headers)
return the audio file in binary format, or as base64 text (useless in most case)

PATCH /musics/{id}
accept JSON and return all updated metadata in JSON
used to modify metadata

PUT /musics/{id} 
used to replace audio file (to be defined later)

DELETE /musics/{id}
Delete the music and metadata.

5eme deploy fonctionnel !

@electro_331 si tu utilise Bruno pour faire des appels API, tu peut récupérer les appels API prêt à l'emploi dans le dossier "bruno" du github, sinon en gros : 

URL : https://nu8n9r0hl5.execute-api.eu-west-1.amazonaws.com

GET /musics
GET /musics/<ID>
GET /musics/<ID>/download
POST /musics
DELETE /musics/<ID>

il me reste à faire quelques routes de PATCH et la gestions des tags, mais on peut déjà upload, lister et écouter des musiques 😊

