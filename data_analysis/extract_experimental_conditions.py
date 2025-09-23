import pandas as pd
import numpy as np
import glob
import os

# Load all xlsx files from data directory
data_files = glob.glob('data/experiment_data_*.xlsx')
print(f"Found {len(data_files)} experiment data files")

# Initialize list to store experimental conditions
all_experimental_data = []
all_questionnaire_data = []

for file in data_files:
    try:
        # Read all sheets to understand structure
        excel_file = pd.ExcelFile(file)
        print(f"\n{os.path.basename(file)} sheets: {excel_file.sheet_names}")
        
        # Try to read experimental data sheet
        if 'Experiment Data' in excel_file.sheet_names:
            exp_df = pd.read_excel(file, sheet_name='Experiment Data')
            exp_df['file_id'] = os.path.basename(file)
            all_experimental_data.append(exp_df)
            print(f"  Experiment data: {exp_df.shape}")
            
        # Read questionnaire data
        if 'Questionnaire Data' in excel_file.sheet_names:
            quest_df = pd.read_excel(file, sheet_name='Questionnaire Data')
            quest_df['file_id'] = os.path.basename(file)
            all_questionnaire_data.append(quest_df)
            print(f"  Questionnaire data: {quest_df.shape}")
        
    except Exception as e:
        print(f"Error loading {file}: {e}")

# Combine experimental data
if all_experimental_data:
    experimental_df = pd.concat(all_experimental_data, ignore_index=True)
    print(f"\nTotal experimental data rows: {len(experimental_df)}")
    print(f"Experimental data columns: {list(experimental_df.columns)}")
    
    # Look for condition-related columns
    condition_cols = [col for col in experimental_df.columns if any(keyword in col.lower() 
                      for keyword in ['condition', 'rl', 'individual', 'joint', 'treatment', 'group'])]
    print(f"\nPotential condition columns: {condition_cols}")
    
    # Show unique values for condition columns
    for col in condition_cols:
        unique_vals = experimental_df[col].unique()
        print(f"{col} unique values: {unique_vals}")
    
    # Save experimental data
    experimental_df.to_csv('experimental_conditions_data.csv', index=False)
    print(f"\nExperimental data saved to: experimental_conditions_data.csv")

# Combine questionnaire data
if all_questionnaire_data:
    questionnaire_df = pd.concat(all_questionnaire_data, ignore_index=True)
    print(f"\nQuestionnaire data shape: {questionnaire_df.shape}")
    
    # Try to merge with experimental conditions based on file_id
    if all_experimental_data:
        print("\nAttempting to merge questionnaire data with experimental conditions...")
        
        # Get unique experimental conditions per file
        exp_conditions = experimental_df.groupby('file_id').first().reset_index()
        
        # Merge questionnaire with conditions
        merged_df = questionnaire_df.merge(exp_conditions[['file_id'] + condition_cols], 
                                         on='file_id', how='left')
        
        print(f"Merged data shape: {merged_df.shape}")
        print(f"Merged columns: {list(merged_df.columns)}")
        
        # Save merged data
        merged_df.to_csv('combined_questionnaire_with_conditions.csv', index=False)
        print("Merged questionnaire data with conditions saved to: combined_questionnaire_with_conditions.csv")
        
        # Show condition distribution
        for col in condition_cols:
            if col in merged_df.columns:
                print(f"\n{col} distribution:")
                print(merged_df[col].value_counts())

else:
    print("No experimental data found")