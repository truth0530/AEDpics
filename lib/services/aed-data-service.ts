/**
 * AED Data Service Layer
 * Handles all AED data operations with proper pagination, filtering, and caching
 */

// TODO: Supabase 클라이언트 임시 비활성화
// import { createClient } from '@/lib/supabase/client';
import { AEDDevice } from '@/types/aed';
import { logger } from '@/lib/logger';

// 임시: 타입 정의
interface FilterOptions {
  [key: string]: any;
}

interface InspectionData {
  [key: string]: any;
}

interface ScheduleEntry {
  [key: string]: any;
}

// 임시: createClient 대체
const createClient = (): any => {
  return null;
};

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AEDFilters extends FilterOptions {
  searchTerm?: string;
  regionCode?: string;
  cityCode?: string;
  managementStatus?: string[];
  inspectionStatus?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

class AEDDataService {
  private supabase = createClient();

  /**
   * Get paginated list of AED devices
   */
  async getDevices(
    filters: AEDFilters = {},
    pagination: PaginationOptions = {}
  ) {
    const {
      page = 1,
      limit = 50,
      sortBy = 'updated_at',
      sortOrder = 'desc'
    } = pagination;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('aed_data')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.searchTerm) {
      query = query.or(
        `location_name.ilike.%${filters.searchTerm}%,` +
        `equipment_serial.ilike.%${filters.searchTerm}%,` +
        `address_detail.ilike.%${filters.searchTerm}%`
      );
    }

    if (filters.regionCode && filters.regionCode !== 'all') {
      query = query.eq('region_code', filters.regionCode);
    }

    if (filters.cityCode && filters.cityCode !== 'all') {
      query = query.eq('city_code', filters.cityCode);
    }

    if (filters.managementStatus?.length) {
      query = query.in('management_status', filters.managementStatus);
    }

    // Sorting and pagination
    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('AEDDataService:getDevices', 'Error fetching AED devices', { error });
      throw new Error('Failed to fetch AED devices');
    }

    return {
      devices: data || [],
      total: count || 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  /**
   * Get single AED device by serial number
   */
  async getDeviceBySerial(serialNumber: string) {
    const { data, error } = await this.supabase
      .from('aed_data')
      .select('*')
      .eq('equipment_serial', serialNumber)
      .single();

    if (error) {
      logger.error('AEDDataService:getDeviceBySerial', 'Error fetching AED device', { error, serialNumber });
      throw new Error('Failed to fetch AED device');
    }

    return data;
  }

  /**
   * Create new inspection record
   */
  async createInspection(inspectionData: InspectionData) {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData?.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await this.supabase
      .from('inspections')
      .insert({
        aed_device_serial: inspectionData.deviceSerial,
        inspector_id: userData.user.id,
        inspection_date: new Date().toISOString(),
        status: inspectionData.status || 'pending',
        overall_score: inspectionData.overallScore,
        notes: inspectionData.notes,
        inspection_data: inspectionData.data
      })
      .select()
      .single();

    if (error) {
      logger.error('AEDDataService:createInspection', 'Error creating inspection', { error });
      throw new Error('Failed to create inspection');
    }

    return data;
  }

  /**
   * Get inspection history for a device
   */
  async getInspectionHistory(deviceSerial: string, limit = 10) {
    const { data, error } = await this.supabase
      .from('inspections')
      .select(`
        *,
        inspector:user_profiles(name, email)
      `)
      .eq('aed_device_serial', deviceSerial)
      .order('inspection_date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('AEDDataService:getInspectionHistory', 'Error fetching inspection history', { error, deviceSerial });
      throw new Error('Failed to fetch inspection history');
    }

    return data || [];
  }

  /**
   * Create schedule entry for an AED
   */
  async createScheduleEntry(scheduleData: ScheduleEntry) {
    const { data: userData, error: userError } = await this.supabase.auth.getUser();

    if (userError || !userData?.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await this.supabase
      .from('inspection_schedule_entries')
      .insert({
        device_equipment_serial: scheduleData.deviceSerial,
        scheduled_for: scheduleData.scheduledFor,
        assignee_identifier: scheduleData.assigneeIdentifier,
        priority: scheduleData.priority || 'normal',
        status: 'scheduled',
        notes: scheduleData.notes,
        created_by: userData.user.id
      })
      .select()
      .single();

    if (error) {
      logger.error('AEDDataService:createScheduleEntry', 'Error creating schedule entry', { error });
      throw new Error('Failed to create schedule entry');
    }

    return data;
  }

  /**
   * Get upcoming scheduled inspections
   */
  async getUpcomingSchedules(
    filters: { assigneeIdentifier?: string; deviceSerial?: string } = {},
    limit = 20
  ) {
    let query = this.supabase
      .from('inspection_schedule_entries')
      .select('*')
      .gte('scheduled_for', new Date().toISOString())
      .eq('status', 'scheduled')
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (filters.assigneeIdentifier) {
      query = query.eq('assignee_identifier', filters.assigneeIdentifier);
    }

    if (filters.deviceSerial) {
      query = query.eq('device_equipment_serial', filters.deviceSerial);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('AEDDataService:getUpcomingSchedules', 'Error fetching schedules', { error, filters });
      throw new Error('Failed to fetch schedules');
    }

    return data || [];
  }

  /**
   * Get device statistics for dashboard
   */
  async getDeviceStatistics(organizationId?: string) {
    // Get total counts by status
    const { data: statusCounts, error: statusError } = await this.supabase
      .rpc('get_aed_status_counts', { org_id: organizationId });

    if (statusError) {
      logger.error('AEDDataService:getDeviceStatistics', 'Error fetching status counts', { error: statusError, organizationId });
    }

    // Get recent inspections count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: recentInspections } = await this.supabase
      .from('inspections')
      .select('*', { count: 'exact', head: true })
      .gte('inspection_date', thirtyDaysAgo.toISOString());

    // Get GPS issues count
    const { count: gpsIssues } = await this.supabase
      .from('gps_issues')
      .select('*', { count: 'exact', head: true })
      .eq('is_resolved', false);

    return {
      statusCounts: statusCounts || {},
      recentInspections: recentInspections || 0,
      unresolvedGpsIssues: gpsIssues || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Batch update AED devices (for admin use)
   */
  async batchUpdateDevices(
    serialNumbers: string[],
    updates: Partial<AEDDevice>
  ) {
    const { data, error } = await this.supabase
      .from('aed_data')
      .update(updates)
      .in('equipment_serial', serialNumbers)
      .select();

    if (error) {
      logger.error('AEDDataService:batchUpdateDevices', 'Error batch updating devices', { error, count: serialNumbers.length });
      throw new Error('Failed to batch updating devices');
    }

    return data || [];
  }

  /**
   * Search devices with fuzzy matching
   */
  async searchDevices(searchTerm: string, limit = 10) {
    const { data, error } = await this.supabase
      .rpc('search_aed_devices', {
        search_term: searchTerm,
        result_limit: limit
      });

    if (error) {
      logger.error('AEDDataService:searchDevices', 'Error searching devices', { error, searchTerm });
      throw new Error('Failed to search devices');
    }

    return data || [];
  }
}

// Export singleton instance
export const aedDataService = new AEDDataService();