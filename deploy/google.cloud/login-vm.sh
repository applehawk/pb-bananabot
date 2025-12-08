#!/bin/bash

# Login to Google Cloud VM
gcloud compute ssh bananabot-vm -- -t "cd ~/bananabot; bash --login"