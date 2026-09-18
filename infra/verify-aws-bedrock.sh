#!/bin/bash
set -euo pipefail

REGION="${RIVEN_AWS_REGION:-ap-south-1}"

echo "== AWS identity =="
aws sts get-caller-identity

echo
echo "== Region =="
echo "$REGION"

echo
echo "== Bedrock control-plane access =="
aws bedrock list-foundation-models \
  --region "$REGION" \
  --query 'modelSummaries[].{id:modelId,provider:providerName,name:modelName,input:inputModalities,output:outputModalities}' \
  --output table

echo
echo "Control-plane discovery completed."
echo "This proves AWS identity + Bedrock model-list access only."
echo "It does NOT prove that any specific model can be invoked."
echo "Next gate: configure one verified model ID and execute a live Bedrock Runtime smoke test."
