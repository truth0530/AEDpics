-- Add indexes for target_list_2024 table to improve query performance
CREATE INDEX IF NOT EXISTS idx_target_list_2024_year ON aedpics.target_list_2024(data_year);
CREATE INDEX IF NOT EXISTS idx_target_list_2024_sido ON aedpics.target_list_2024(sido);
CREATE INDEX IF NOT EXISTS idx_target_list_2024_gugun ON aedpics.target_list_2024(gugun);
CREATE INDEX IF NOT EXISTS idx_target_list_2024_target_key ON aedpics.target_list_2024(target_key);
CREATE INDEX IF NOT EXISTS idx_target_list_2024_institution ON aedpics.target_list_2024(institution_name);
CREATE INDEX IF NOT EXISTS idx_target_list_2024_composite ON aedpics.target_list_2024(data_year, sido, gugun);

-- Add indexes for management_number_group_mapping table
CREATE INDEX IF NOT EXISTS idx_mgmt_mapping_2024 ON aedpics.management_number_group_mapping(target_key_2024);
CREATE INDEX IF NOT EXISTS idx_mgmt_mapping_2025 ON aedpics.management_number_group_mapping(target_key_2025);
CREATE INDEX IF NOT EXISTS idx_mgmt_mapping_number ON aedpics.management_number_group_mapping(management_number);

-- Add indexes for aed_data table
CREATE INDEX IF NOT EXISTS idx_aed_data_sido ON aedpics.aed_data(sido);
CREATE INDEX IF NOT EXISTS idx_aed_data_sigungu ON aedpics.aed_data(sigungu);
CREATE INDEX IF NOT EXISTS idx_aed_data_mgmt_number ON aedpics.aed_data(management_number);
CREATE INDEX IF NOT EXISTS idx_aed_data_institution ON aedpics.aed_data(installation_institution);
CREATE INDEX IF NOT EXISTS idx_aed_data_composite ON aedpics.aed_data(sido, sigungu);