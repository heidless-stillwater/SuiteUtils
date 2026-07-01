import requests
import subprocess
import json

token = subprocess.check_output(['gcloud', 'auth', 'print-access-token']).decode('utf-8').strip()
ruleset = "projects/stillwater-sovereign-02/rulesets/cebdacae-a65c-48bb-9479-aa85d305602b"
databases = [
    'persona-db-0', 'prompttool-db-0', 'promptresources-db-0', 
    'promptmaster-spa-db-0', 'promptaccreditation-db-0', 
    'plantune-db-0', 'suiteutils-db-0', 'autovideo-db-0'
]

print("--- Sovereign Protocol Release ---")
for db in databases:
    url = f"https://firebaserules.googleapis.com/v1/projects/stillwater-sovereign-02/releases/cloud.firestore%2F{db}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Goog-User-Project": "stillwater-sovereign-02"
    }
    payload = {
        "rulesetName": ruleset
    }
    # We use PATCH to update the release. If it doesn't exist, we might need POST to /releases
    res = requests.patch(url, headers=headers, json=payload)
    if res.status_code == 200:
        print(f"✅ {db} UNLOCKED.")
    elif res.status_code == 404:
        # Try POST instead
        url_create = "https://firebaserules.googleapis.com/v1/projects/stillwater-sovereign-02/releases"
        payload_create = {
            "name": f"projects/stillwater-sovereign-02/releases/cloud.firestore/{db}",
            "rulesetName": ruleset
        }
        res_create = requests.post(url_create, headers=headers, json=payload_create)
        if res_create.status_code == 200:
            print(f"✅ {db} CREATED & UNLOCKED.")
        else:
            print(f"❌ {db} CREATE FAILED: {res_create.text}")
    else:
        print(f"❌ {db} PATCH FAILED: {res.text}")
