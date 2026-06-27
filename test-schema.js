import { createClient } from '@supabase/supabase-js'

const supabase = createClient('url', 'key')
// we can just check local files for the db schema if available or use sql
