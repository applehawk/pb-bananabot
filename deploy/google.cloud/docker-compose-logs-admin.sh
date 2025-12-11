#!/bin/bash

# Login to Google Cloud VM and stream logs
gcloud compute ssh bananabot-vm -- -t "cd ~/bananabot && docker compose logs -f admin"