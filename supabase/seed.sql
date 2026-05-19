-- ============================================================================
-- StayOps — seed data
-- Run AFTER you've created test users in Supabase Dashboard > Authentication.
-- See supabase/SETUP.md for the user-creation steps.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Properties (per spec)
-- ----------------------------------------------------------------------------
insert into public.properties (id, name, location, lat, lng, geofence_meters) values
  ('ekaha1', 'Ekaha Homes',    'Sector 27, Chandigarh',   30.7333, 76.7794, 100),
  ('ekaha2', 'Ekaha Homes II', 'Sector 27/1, Chandigarh', 30.7335, 76.7797, 100),
  ('ekaha7', 'Ekaha 7',        'Phase 7, Mohali',         30.7046, 76.7179, 100)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Rooms — one suite per property to start; owner can add more later
-- ----------------------------------------------------------------------------
insert into public.rooms (property_id, name, room_type) values
  ('ekaha1', 'Suite A', 'suite'),
  ('ekaha1', 'Suite B', 'suite'),
  ('ekaha2', 'Suite A', 'suite'),
  ('ekaha2', 'Suite B', 'suite'),
  ('ekaha7', 'Suite A', 'suite'),
  ('ekaha7', 'Suite B', 'suite')
on conflict (property_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- Sample checklist template (one per property, "full clean")
-- ----------------------------------------------------------------------------
insert into public.templates (name, property_id, room_type, tasks) values
('Suite — Full Clean', 'ekaha1', 'suite', '[
  {"task_id":"bed1","name":"Strip & remake bed","instructions":"Fresh linens, pillows fluffed","zone":"bedroom","mandatory":true,"photo_required":true,"sequence":1,"estimated_minutes":10,"linked_inventory_item":"bedsheet"},
  {"task_id":"bed2","name":"Dust surfaces","instructions":"Tables, sills, lamps","zone":"bedroom","mandatory":true,"photo_required":false,"sequence":2,"estimated_minutes":5,"linked_inventory_item":null},
  {"task_id":"bath1","name":"Toilet + sink clean","instructions":"Cleaner, scrub, wipe dry","zone":"bathroom","mandatory":true,"photo_required":true,"sequence":3,"estimated_minutes":8,"linked_inventory_item":null},
  {"task_id":"bath2","name":"Restock toiletries","instructions":"Replace shampoo, bodywash, handwash if below half. New toilet roll.","zone":"bathroom","mandatory":true,"photo_required":true,"sequence":4,"estimated_minutes":4,"linked_inventory_item":"toilet_roll"},
  {"task_id":"bath3","name":"Fresh towels","instructions":"2 bath + 2 hand","zone":"bathroom","mandatory":true,"photo_required":true,"sequence":5,"estimated_minutes":3,"linked_inventory_item":"bath_towel"},
  {"task_id":"kit1","name":"Kitchen counter + sink","instructions":"Wipe down, dishes done","zone":"kitchen","mandatory":true,"photo_required":false,"sequence":6,"estimated_minutes":7,"linked_inventory_item":null},
  {"task_id":"kit2","name":"Restock tea/coffee/sugar","instructions":"Refill sachets to 4 each","zone":"kitchen","mandatory":true,"photo_required":true,"sequence":7,"estimated_minutes":3,"linked_inventory_item":"tea_sachet"},
  {"task_id":"kit3","name":"Drinking water bottles","instructions":"Restock 2x1L","zone":"kitchen","mandatory":true,"photo_required":true,"sequence":8,"estimated_minutes":2,"linked_inventory_item":"water_bottle"},
  {"task_id":"com1","name":"Floor sweep + mop","instructions":"All rooms","zone":"common","mandatory":true,"photo_required":false,"sequence":9,"estimated_minutes":12,"linked_inventory_item":null},
  {"task_id":"com2","name":"Trash out","instructions":"All bins, new liners","zone":"common","mandatory":true,"photo_required":true,"sequence":10,"estimated_minutes":4,"linked_inventory_item":null}
]'::jsonb),
('Suite — Full Clean', 'ekaha2', 'suite', '[
  {"task_id":"bed1","name":"Strip & remake bed","instructions":"Fresh linens","zone":"bedroom","mandatory":true,"photo_required":true,"sequence":1,"estimated_minutes":10,"linked_inventory_item":"bedsheet"},
  {"task_id":"bath1","name":"Toilet + sink clean","instructions":"Cleaner, scrub","zone":"bathroom","mandatory":true,"photo_required":true,"sequence":2,"estimated_minutes":8,"linked_inventory_item":null},
  {"task_id":"bath2","name":"Restock toiletries","instructions":"Below half = replace","zone":"bathroom","mandatory":true,"photo_required":true,"sequence":3,"estimated_minutes":4,"linked_inventory_item":"toilet_roll"},
  {"task_id":"com1","name":"Floor sweep + mop","instructions":"All rooms","zone":"common","mandatory":true,"photo_required":false,"sequence":4,"estimated_minutes":12,"linked_inventory_item":null}
]'::jsonb),
('Suite — Full Clean', 'ekaha7', 'suite', '[
  {"task_id":"bed1","name":"Strip & remake bed","instructions":"Fresh linens","zone":"bedroom","mandatory":true,"photo_required":true,"sequence":1,"estimated_minutes":10,"linked_inventory_item":"bedsheet"},
  {"task_id":"bath1","name":"Toilet + sink clean","instructions":"Cleaner, scrub","zone":"bathroom","mandatory":true,"photo_required":true,"sequence":2,"estimated_minutes":8,"linked_inventory_item":null},
  {"task_id":"bath2","name":"Restock toiletries","instructions":"Below half = replace","zone":"bathroom","mandatory":true,"photo_required":true,"sequence":3,"estimated_minutes":4,"linked_inventory_item":"toilet_roll"},
  {"task_id":"com1","name":"Floor sweep + mop","instructions":"All rooms","zone":"common","mandatory":true,"photo_required":false,"sequence":4,"estimated_minutes":12,"linked_inventory_item":null}
]'::jsonb)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Inventory items — seed common consumables per property
-- ----------------------------------------------------------------------------
insert into public.inventory_items (property_id, name, tracking_model, cupboard_qty, room_qty, reorder_threshold, reorder_qty, unit) values
  -- count units
  ('ekaha1', 'Toilet roll',        'count',   20, 4,  8,  24, 'roll'),
  ('ekaha1', 'Water bottle 1L',    'count',   24, 4,  12, 24, 'bottle'),
  ('ekaha1', 'Shampoo bottle',     'count',   6,  2,  4,  12, 'bottle'),
  ('ekaha1', 'Bodywash bottle',    'count',   6,  2,  4,  12, 'bottle'),
  ('ekaha1', 'Handwash bottle',    'count',   6,  2,  4,  12, 'bottle'),
  ('ekaha1', 'Tea sachet',         'count',   80, 8,  40, 100, 'sachet'),
  ('ekaha1', 'Coffee sachet',      'count',   60, 8,  30, 80, 'sachet'),
  ('ekaha1', 'Sugar sachet',       'count',   80, 8,  40, 100, 'sachet'),
  ('ekaha1', 'Bath towel',         'count',   12, 4,  6,  12, 'piece'),
  ('ekaha1', 'Hand towel',         'count',   12, 4,  6,  12, 'piece'),
  ('ekaha1', 'Bedsheet',           'count',   8,  2,  4,  8,  'piece'),
  ('ekaha1', 'Pillow cover',       'count',   12, 4,  6,  12, 'piece'),
  -- par level
  ('ekaha1', 'Toilet cleaner',     'par',     2,  0,  1,  2,  'bottle'),
  ('ekaha1', 'Floor cleaner',      'par',     2,  0,  1,  2,  'bottle'),
  ('ekaha1', 'Dishwasher liquid',  'par',     2,  0,  1,  2,  'bottle'),
  ('ekaha1', 'Room freshener',     'par',     2,  0,  1,  2,  'bottle')
on conflict (property_id, name) do nothing;

-- Copy the same seed to ekaha2 and ekaha7
insert into public.inventory_items (property_id, name, tracking_model, cupboard_qty, room_qty, reorder_threshold, reorder_qty, unit)
select 'ekaha2', name, tracking_model, cupboard_qty, room_qty, reorder_threshold, reorder_qty, unit
from public.inventory_items where property_id = 'ekaha1'
on conflict (property_id, name) do nothing;

insert into public.inventory_items (property_id, name, tracking_model, cupboard_qty, room_qty, reorder_threshold, reorder_qty, unit)
select 'ekaha7', name, tracking_model, cupboard_qty, room_qty, reorder_threshold, reorder_qty, unit
from public.inventory_items where property_id = 'ekaha1'
on conflict (property_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- Test user role assignment
-- After creating users in Dashboard, run these to set roles + property access.
-- Replace the emails with the ones you created.
--
-- update public.profiles set role = 'owner',  property_ids = array['ekaha1','ekaha2','ekaha7']
--   where email = 'owner@ekaha.test';
-- update public.profiles set role = 'manager', property_ids = array['ekaha1','ekaha2','ekaha7']
--   where email = 'manager@ekaha.test';
-- update public.profiles set role = 'staff',   property_ids = array['ekaha1','ekaha2']
--   where email = 'staff1@ekaha.test';
-- update public.profiles set role = 'staff',   property_ids = array['ekaha7']
--   where email = 'staff2@ekaha.test';
-- ----------------------------------------------------------------------------
