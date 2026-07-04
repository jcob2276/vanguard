import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SB_SECRET_KEY;
const userId = process.env.VANGUARD_USER_ID;

if (!supabaseUrl || !supabaseKey || !userId) {
  console.error("Missing Supabase credentials or user ID in environment", { supabaseUrl, supabaseKey, userId });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

// Left eye: OS (sphere_l, cyl_l, axis_l)
// Right eye: OD (sphere_r, cyl_r, axis_r)
const excelData = [
  { 
    user_id: userId, 
    type: 'normalized', 
    status: 'active', 
    started_at: '2022-06-15', 
    sphere_r: -2.75, 
    cyl_r: null, 
    axis_r: null, 
    sphere_l: -4.25, 
    cyl_l: -0.75, 
    axis_l: 10, 
    notes: 'PD 61mm' 
  },
  { 
    user_id: userId, 
    type: 'normalized', 
    status: 'past', 
    started_at: '2020-10-24', 
    ended_at: '2022-06-15', 
    sphere_r: -3.25, 
    cyl_r: null, 
    axis_r: null, 
    sphere_l: -4.50, 
    cyl_l: -0.75, 
    axis_l: 10, 
    notes: 'Stare - normalizacja' 
  },
  { 
    user_id: userId, 
    type: 'normalized', 
    status: 'past', 
    started_at: '2019-07-24', 
    ended_at: '2020-10-24', 
    sphere_r: -3.50, 
    cyl_r: null, 
    axis_r: null, 
    sphere_l: -4.50, 
    cyl_l: -0.75, 
    axis_l: 10, 
    notes: 'Stare - normalizacja' 
  },
  { 
    user_id: userId, 
    type: 'differential', 
    status: 'active', 
    started_at: '2024-12-25', 
    sphere_r: -1.50, 
    cyl_r: null, 
    axis_r: null, 
    sphere_l: -3.00, 
    cyl_l: -0.75, 
    axis_l: 10,
    notes: 'mg być idealne' 
  },
  { 
    user_id: userId, 
    type: 'differential', 
    status: 'past', 
    started_at: '2024-12-25', 
    ended_at: '2024-12-25', 
    sphere_r: -1.75, 
    cyl_r: null, 
    axis_r: null, 
    sphere_l: -3.25, 
    cyl_l: -0.75, 
    axis_l: 10,
    notes: 'za mocne' 
  },
  { 
    user_id: userId, 
    type: 'differential', 
    status: 'past', 
    started_at: '2024-12-25', 
    ended_at: '2024-12-25', 
    sphere_r: -1.25, 
    cyl_r: null, 
    axis_r: null, 
    sphere_l: -2.75, 
    cyl_l: -0.75, 
    axis_l: 10,
    notes: 'za słabe' 
  }
];

async function seed() {
  console.log("Seeding EndMyopia prescriptions for user:", userId);
  
  // Clear existing prescriptions to avoid duplicates
  const { error: deleteError } = await supabase
    .from('endmyopia_prescriptions')
    .delete()
    .eq('user_id', userId);
    
  if (deleteError) {
    console.error("Error clearing old prescriptions:", deleteError);
    process.exit(1);
  }
  
  const { data, error } = await supabase
    .from('endmyopia_prescriptions')
    .insert(excelData)
    .select();
    
  if (error) {
    console.error("Error inserting prescriptions:", error);
    process.exit(1);
  }
  
  console.log("Successfully seeded endmyopia prescriptions count:", data.length);
}

seed();
