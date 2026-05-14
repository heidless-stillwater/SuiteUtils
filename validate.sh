#!/bin/bash

PLAN_DIR="/home/heidless/projects/SuiteUtils/docs/validation-plans"

if [ ! -d "$PLAN_DIR" ]; then
    echo "❌ Validation plans directory not found: $PLAN_DIR"
    exit 1
fi

# List available plans
echo "--- 🛰️ Sovereign Validation Center ---"
echo "Select a validation plan to execute:"
plans=($(ls "$PLAN_DIR"/*.md))
if [ ${#plans[@]} -eq 0 ]; then
    echo "❌ No validation plans found."
    exit 1
fi

for i in "${!plans[@]}"; do
    echo "[$i] $(basename "${plans[$i]}")"
done

read -p "Enter index: " idx
SELECTED_PLAN="${plans[$idx]}"

if [ -z "$SELECTED_PLAN" ]; then
    echo "❌ Invalid selection."
    exit 1
fi

echo "--- 📜 Validating: $(basename "$SELECTED_PLAN") ---"

# Simple parser for Test Steps and Success Criteria
while IFS= read -r line; do
    if [[ "$line" =~ ^"## " ]]; then
        echo -e "\n\033[1;34m${line:3}\033[0m"
    elif [[ "$line" =~ ^"### Test Steps" ]]; then
        echo -e "\033[1;33mTest Steps:\033[0m"
    elif [[ "$line" =~ ^[0-9]"." ]]; then
        echo -e "  $line"
    elif [[ "$line" =~ ^"    \`\`\`" ]]; then
        # Skip code blocks for now, or print them simply
        continue
    elif [[ "$line" =~ ^"- [ ] " ]]; then
        criterion="${line:6}"
        echo -e "\033[1;35mSUCCESS CRITERIA:\033[0m $criterion"
        read -p "Did this pass? (y/n): " result
        if [[ "$result" == "y" ]]; then
            echo -e "✅ \033[0;32mPASSED\033[0m"
        else
            echo -e "❌ \033[0;31mFAILED\033[0m"
            exit 1
        fi
    fi
done < "$SELECTED_PLAN"

echo -e "\n\033[1;32m🎉 Validation Complete: $(basename "$SELECTED_PLAN") PASSED ALL CRITERIA\033[0m"
