import { callWebSocAPI } from "websoc-api";

import { Course, CourseOffering } from "../types/types";
import { Section, WebsocResponse } from "../types/websoc.types";
import { getCourse } from "./courses.helper";

// Format Course Offering
// Given a course from the websoc api, we need to format it for graphql
// and inject some addtional information such as the course id, year, and quarter
function _formatCourseOffering(
  course: Section,
  additionalArgs: { year: string; course: Course; quarter: string }
): CourseOffering {
  return {
    ...additionalArgs,
    final_exam: course.finalExam,
    instructors: course.instructors,
    max_capacity: parseInt(course.maxCapacity),
    meetings: course.meetings,
    num_section_enrolled:
      course.numCurrentlyEnrolled.sectionEnrolled === ""
        ? 0
        : parseInt(course.numCurrentlyEnrolled.sectionEnrolled),
    num_total_enrolled:
      course.numCurrentlyEnrolled.totalEnrolled === ""
        ? 0
        : parseInt(course.numCurrentlyEnrolled.totalEnrolled),
    num_new_only_reserved:
      course.numNewOnlyReserved === ""
        ? 0
        : parseInt(course.numNewOnlyReserved),
    num_on_waitlist:
      course.numOnWaitlist === "" ? 0 : parseInt(course.numOnWaitlist),
    num_requested:
      course.numRequested === "" ? 0 : parseInt(course.numRequested),
    restrictions: course.restrictions,
    section: {
      code: course.sectionCode,
      comment: course.sectionComment,
      number: course.sectionNum,
      type: course.sectionType,
    },
    status: course.status,
    units: parseInt(course.units),
  };
}

// Format Schedule query arguments for WebSoc
export function scheduleArgsToQuery(args: Record<string, string>) {
  const {
    year,
    quarter,
    ge,
    department,
    course_number,
    division,
    section_codes,
    instructor,
    course_title,
    section_type,
    units,
    days,
    start_time,
    end_time,
    max_capacity,
    full_courses,
    cancelled_courses,
    building,
    room,
  } = args;
  return {
    term: year + " " + quarter,
    ge: ge,
    department: department,
    courseNumber: course_number,
    division: division,
    sectionCodes: section_codes,
    instructorName: instructor,
    courseTitle: course_title,
    sectionType: section_type,
    units: units,
    days: days,
    startTime: start_time,
    endTime: end_time,
    maxCapacity: max_capacity,
    fullCourses: full_courses,
    cancelledCourses: cancelled_courses,
    building: building,
    room: room,
  };
}

export async function getCourseSchedules(
  query: Record<string, string>
): Promise<CourseOffering[]> {
  const results = await (<
    (query: Record<string, string>) => Promise<WebsocResponse>
  >callWebSocAPI)(query);
  const year = query.term.split(" ")[0];
  const quarter = query.term.split(" ")[1];
  const offerings: CourseOffering[] = [];
  for (const school of results["schools"]) {
    for (const dept of school["departments"]) {
      for (const course of dept["courses"]) {
        const courseID = (dept["deptCode"] + course["courseNumber"]).replace(
          / /g,
          ""
        );
        course["sections"].forEach((section) => {
          offerings.push(
            _formatCourseOffering(section, {
              course: getCourse(courseID),
              year,
              quarter,
            })
          );
        });
      }
    }
  }
  return offerings;
}
