#!/bin/bash

# Login to Google Cloud VM
ZONE=${ZONE:-"europe-north1-c"}
gcloud compute ssh bananabot-vm --zone=$ZONE -- -t "cd ~/bananabot; bash --login"