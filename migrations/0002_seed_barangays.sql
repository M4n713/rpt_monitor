-- Migration 002: Seed barangays

INSERT INTO barangays (code, name) VALUES
  ('0001', 'Batong Buhay'),
  ('0002', 'Buenavista'),
  ('0003', 'Burgos'),
  ('0004', 'Claudio Salgado'),
  ('0005', 'Ligaya'),
  ('0006', 'Paetan'),
  ('0007', 'Pag-asa'),
  ('0008', 'Sta. Lucia'),
  ('0009', 'San Vicente'),
  ('0010', 'Sto. Niño'),
  ('0011', 'Tagumpay'),
  ('0012', 'Victoria'),
  ('0013', 'Poblacion'),
  ('0014', 'San Agustin'),
  ('0015', 'Gen. Emilio Aguinaldo'),
  ('0016', 'Ibud'),
  ('0017', 'Ilvita'),
  ('0018', 'Lagnas'),
  ('0019', 'Malisbong'),
  ('0020', 'San Francisco'),
  ('0021', 'San Nicolas'),
  ('0022', 'Tuban')
ON CONFLICT (code) DO NOTHING;
