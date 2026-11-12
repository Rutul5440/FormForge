using FormForge.Api.Models;

namespace FormForge.Api.Services;

public static class StarterTemplates
{
    public static readonly IReadOnlyList<StarterTemplateDefinition> All =
    [
        new(
            Key: "resident-intake",
            Title: "New Resident Intake",
            Category: "Clinical & Care",
            Description: "Collect resident identity, date of birth, assessed care tier, and guardian consent signature.",
            Schema: new FormSchema
            {
                Fields =
                [
                    new FieldDefinition
                    {
                        Id = "f1", Key = "full_name", Type = "text", Label = "Full name",
                        Placeholder = "e.g. Margaret Holloway", Required = true,
                        Validation = new FieldValidation { MinLength = 2, MaxLength = 120 }
                    },
                    new FieldDefinition
                    {
                        Id = "f2", Key = "date_of_birth", Type = "date", Label = "Date of birth",
                        HelpText = "Used for care placement verification.", Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f3", Key = "care_level", Type = "dropdown", Label = "Care level",
                        Placeholder = "Select care tier", Required = true,
                        Options = ["Low", "Medium", "High"]
                    },
                    new FieldDefinition
                    {
                        Id = "f4", Key = "guardian_signature", Type = "signature", Label = "Guardian signature",
                        HelpText = "Sign with mouse or touch to confirm intake accuracy.", Required = true
                    }
                ]
            }
        ),
        new(
            Key: "leave-request",
            Title: "Employee Leave Request",
            Category: "Human Resources",
            Description: "Standard time-off request capturing employee details, leave type, start/end dates, and manager approval.",
            Schema: new FormSchema
            {
                Fields =
                [
                    new FieldDefinition
                    {
                        Id = "f1", Key = "employee_name", Type = "text", Label = "Employee name",
                        Placeholder = "Full legal name", Required = true,
                        Validation = new FieldValidation { MinLength = 2, MaxLength = 100 }
                    },
                    new FieldDefinition
                    {
                        Id = "f2", Key = "leave_type", Type = "dropdown", Label = "Leave reason",
                        Placeholder = "Choose leave category", Required = true,
                        Options = ["Annual Leave", "Sick Leave", "Parental Leave", "Unpaid Leave"]
                    },
                    new FieldDefinition
                    {
                        Id = "f3", Key = "start_date", Type = "date", Label = "Start date", Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f4", Key = "end_date", Type = "date", Label = "Return date", Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f5", Key = "manager_signature", Type = "signature", Label = "Manager signature",
                        HelpText = "Supervisor authorization signature.", Required = true
                    }
                ]
            }
        ),
        new(
            Key: "event-registration",
            Title: "Event Registration",
            Category: "Operations",
            Description: "Register attendees with preferred session date, track selection, and attendance acknowledgment.",
            Schema: new FormSchema
            {
                Fields =
                [
                    new FieldDefinition
                    {
                        Id = "f1", Key = "attendee_name", Type = "text", Label = "Attendee name",
                        Placeholder = "Badge display name", Required = true,
                        Validation = new FieldValidation { MinLength = 2, MaxLength = 100 }
                    },
                    new FieldDefinition
                    {
                        Id = "f2", Key = "session_date", Type = "date", Label = "Attendance date", Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f3", Key = "session_track", Type = "dropdown", Label = "Session track",
                        Placeholder = "Select primary track", Required = true,
                        Options = ["Keynote Briefing", "Hands-on Workshop", "Architecture Clinic"]
                    },
                    new FieldDefinition
                    {
                        Id = "f4", Key = "consent_signature", Type = "signature", Label = "Code of conduct signature",
                        Required = true
                    }
                ]
            }
        ),
        new(
            Key: "feedback-survey",
            Title: "Customer Feedback Survey",
            Category: "Service Quality",
            Description: "Post-visit service review capturing customer name, visit date, rating tier, and sign-off.",
            Schema: new FormSchema
            {
                Fields =
                [
                    new FieldDefinition
                    {
                        Id = "f1", Key = "respondent_name", Type = "text", Label = "Respondent name",
                        Placeholder = "Optional or full name", Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f2", Key = "visit_date", Type = "date", Label = "Service date", Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f3", Key = "satisfaction", Type = "dropdown", Label = "Overall experience",
                        Placeholder = "Select rating", Required = true,
                        Options = ["Excellent", "Good", "Needs Improvement"]
                    },
                    new FieldDefinition
                    {
                        Id = "f4", Key = "comments", Type = "text", Label = "Key takeaway",
                        Placeholder = "What worked well or needs attention?", Required = false,
                        Validation = new FieldValidation { Multiline = true, MaxLength = 600 }
                    },
                    new FieldDefinition
                    {
                        Id = "f5", Key = "reviewer_signature", Type = "signature", Label = "Reviewer signature",
                        Required = false
                    }
                ]
            }
        ),
        new(
            Key: "contact-intake",
            Title: "General Contact Intake",
            Category: "Client Desk",
            Description: "Fast front-desk contact inquiry with callback scheduling, topic routing, and consent.",
            Schema: new FormSchema
            {
                Fields =
                [
                    new FieldDefinition
                    {
                        Id = "f1", Key = "contact_name", Type = "text", Label = "Full name",
                        Placeholder = "Enter your full name", Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f2", Key = "callback_date", Type = "date", Label = "Preferred callback date",
                        Required = true
                    },
                    new FieldDefinition
                    {
                        Id = "f3", Key = "inquiry_topic", Type = "dropdown", Label = "Inquiry topic",
                        Placeholder = "Select department", Required = true,
                        Options = ["General Inquiry", "Technical Support", "Billing & Records"]
                    },
                    new FieldDefinition
                    {
                        Id = "f4", Key = "notes", Type = "text", Label = "Summary",
                        Placeholder = "Briefly describe how we can help", Required = true,
                        Validation = new FieldValidation { Multiline = true, MinLength = 5, MaxLength = 500 }
                    }
                ]
            }
        )
    ];

    public static StarterTemplateDefinition? FindByKey(string key) =>
        All.FirstOrDefault(t => string.Equals(t.Key, key, StringComparison.OrdinalIgnoreCase));
}
