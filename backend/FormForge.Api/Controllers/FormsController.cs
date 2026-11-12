using System.Text.Json;
using System.Text.RegularExpressions;
using FormForge.Api.Data;
using FormForge.Api.FieldRegistry;
using FormForge.Api.Models;
using FormForge.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FormForge.Api.Controllers;

[ApiController]
[Route("api/forms")]
public sealed class FormsController(
    FormForgeDbContext db,
    FieldRegistryService registry,
    ExcelExportService excelExport) : ControllerBase
{
    public sealed record CreateFormRequest(string Title, string? Description, FormSchema? Schema);
    public sealed record UpdateDraftRequest(string Title, string? Description, FormSchema Schema);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<object>>> ListForms(CancellationToken ct)
    {
        var forms = await db.Forms
            .AsNoTracking()
            .OrderByDescending(f => f.UpdatedAt)
            .Select(f => new
            {
                f.Id,
                f.CatalogCode,
                f.Slug,
                f.Title,
                f.Description,
                f.ActiveVersionId,
                ActiveVersionNumber = f.Versions
                    .Where(v => v.Id == f.ActiveVersionId)
                    .Select(v => (int?)v.VersionNumber)
                    .FirstOrDefault(),
                TotalVersions = f.Versions.Count,
                TotalResponses = f.Versions.SelectMany(v => v.Responses).Count(),
                ActiveSchemaJson = f.Versions
                    .Where(v => v.Id == f.ActiveVersionId)
                    .Select(v => v.SchemaJson)
                    .FirstOrDefault(),
                f.CurrentDraftJson,
                f.UpdatedAt
            })
            .ToListAsync(ct);

        var result = forms.Select(f => new
        {
            f.Id,
            f.CatalogCode,
            f.Slug,
            f.Title,
            f.Description,
            f.ActiveVersionId,
            f.ActiveVersionNumber,
            f.TotalVersions,
            f.TotalResponses,
            HasUnpublishedChanges = f.ActiveSchemaJson is null || f.ActiveSchemaJson != f.CurrentDraftJson,
            f.UpdatedAt
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<object>> CreateForm([FromBody] CreateFormRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Form title is required." });

        var schema = request.Schema ?? new FormSchema
        {
            Fields =
            [
                new FieldDefinition
                {
                    Id = "f1",
                    Key = "full_name",
                    Type = "text",
                    Label = "Full name",
                    Placeholder = "Enter your full name",
                    Required = true
                }
            ]
        };

        var schemaErrors = registry.ValidateSchema(schema);
        if (schemaErrors.Count > 0)
            return BadRequest(new { message = "Invalid form schema.", errors = schemaErrors });

        var slug = await FormIdentityHelper.GenerateUniqueSlugAsync(db, request.Title, ct);
        var catalogCode = await FormIdentityHelper.GenerateCatalogCodeAsync(db, ct);
        var now = DateTimeOffset.UtcNow;

        var form = new FormEntity
        {
            Id = Guid.NewGuid(),
            CatalogCode = catalogCode,
            Slug = slug,
            Title = request.Title.Trim(),
            Description = (request.Description ?? string.Empty).Trim(),
            CurrentDraftJson = JsonSerializer.Serialize(schema, FormJson.Options),
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Forms.Add(form);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetForm), new { id = form.Id }, new
        {
            form.Id,
            form.CatalogCode,
            form.Slug,
            form.Title,
            form.Description
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<object>> GetForm(Guid id, CancellationToken ct)
    {
        var form = await db.Forms
            .AsNoTracking()
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Id == id, ct);

        if (form is null)
            return NotFound(new { message = "Form not found." });

        var responseCounts = await db.FormResponses
            .AsNoTracking()
            .Where(r => r.FormId == id)
            .GroupBy(r => r.FormVersionId)
            .Select(g => new { VersionId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.VersionId, x => x.Count, ct);

        var draftSchema = JsonSerializer.Deserialize<FormSchema>(form.CurrentDraftJson, FormJson.Options) ?? new FormSchema();
        var activeVersion = form.Versions.FirstOrDefault(v => v.Id == form.ActiveVersionId);

        var versions = form.Versions
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new
            {
                v.Id,
                v.VersionNumber,
                v.IsPublished,
                v.PublishedAt,
                ResponseCount = responseCounts.GetValueOrDefault(v.Id, 0),
                Schema = JsonSerializer.Deserialize<FormSchema>(v.SchemaJson, FormJson.Options) ?? new FormSchema()
            })
            .ToList();

        return Ok(new
        {
            form.Id,
            form.CatalogCode,
            form.Slug,
            form.Title,
            form.Description,
            form.ActiveVersionId,
            ActiveVersionNumber = activeVersion?.VersionNumber,
            HasUnpublishedChanges = activeVersion is null || activeVersion.SchemaJson != form.CurrentDraftJson,
            DraftSchema = draftSchema,
            Versions = versions,
            form.CreatedAt,
            form.UpdatedAt
        });
    }

    [HttpPut("{id:guid}/draft")]
    public async Task<ActionResult<object>> UpdateDraft(Guid id, [FromBody] UpdateDraftRequest request, CancellationToken ct)
    {
        var form = await db.Forms
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Id == id, ct);

        if (form is null)
            return NotFound(new { message = "Form not found." });

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { message = "Form title is required." });

        var schemaErrors = registry.ValidateSchema(request.Schema);
        if (schemaErrors.Count > 0)
            return BadRequest(new { message = "Draft schema failed validation.", errors = schemaErrors });

        form.Title = request.Title.Trim();
        form.Description = (request.Description ?? string.Empty).Trim();
        form.CurrentDraftJson = JsonSerializer.Serialize(request.Schema, FormJson.Options);
        form.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        var activeVersion = form.Versions.FirstOrDefault(v => v.Id == form.ActiveVersionId);
        return Ok(new
        {
            form.Id,
            form.Title,
            form.Description,
            form.UpdatedAt,
            HasUnpublishedChanges = activeVersion is null || activeVersion.SchemaJson != form.CurrentDraftJson
        });
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<ActionResult<object>> PublishForm(Guid id, CancellationToken ct)
    {
        var form = await db.Forms
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Id == id, ct);

        if (form is null)
            return NotFound(new { message = "Form not found." });

        var schema = JsonSerializer.Deserialize<FormSchema>(form.CurrentDraftJson, FormJson.Options) ?? new FormSchema();
        var schemaErrors = registry.ValidateSchema(schema);
        if (schemaErrors.Count > 0)
            return BadRequest(new { message = "Cannot publish an invalid schema.", errors = schemaErrors });

        int nextVersionNumber = form.Versions.Count == 0
            ? 1
            : form.Versions.Max(v => v.VersionNumber) + 1;

        var version = new FormVersionEntity
        {
            Id = Guid.NewGuid(),
            FormId = form.Id,
            VersionNumber = nextVersionNumber,
            SchemaJson = JsonSerializer.Serialize(schema, FormJson.Options),
            IsPublished = true,
            PublishedAt = DateTimeOffset.UtcNow
        };

        db.FormVersions.Add(version);
        form.ActiveVersionId = version.Id;
        form.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return Ok(new
        {
            version.Id,
            version.VersionNumber,
            version.IsPublished,
            version.PublishedAt,
            form.Slug,
            Schema = schema
        });
    }

    [HttpGet("{id:guid}/responses")]
    public async Task<ActionResult<object>> GetResponses(
        Guid id,
        [FromQuery] Guid? versionId,
        CancellationToken ct)
    {
        var form = await db.Forms
            .AsNoTracking()
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Id == id, ct);

        if (form is null)
            return NotFound(new { message = "Form not found." });

        if (form.Versions.Count == 0)
        {
            return Ok(new
            {
                form.Id,
                form.Title,
                form.CatalogCode,
                SelectedVersion = (object?)null,
                Versions = Array.Empty<object>(),
                Fields = Array.Empty<FieldDefinition>(),
                Responses = Array.Empty<object>()
            });
        }

        var selectedVersion = versionId.HasValue
            ? form.Versions.FirstOrDefault(v => v.Id == versionId.Value)
            : form.Versions.FirstOrDefault(v => v.Id == form.ActiveVersionId)
              ?? form.Versions.OrderByDescending(v => v.VersionNumber).First();

        if (selectedVersion is null)
            return NotFound(new { message = "Requested form version not found." });

        var schema = JsonSerializer.Deserialize<FormSchema>(selectedVersion.SchemaJson, FormJson.Options) ?? new FormSchema();

        var responses = await db.FormResponses
            .AsNoTracking()
            .Where(r => r.FormId == id && r.FormVersionId == selectedVersion.Id)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);

        var countsByVersion = await db.FormResponses
            .AsNoTracking()
            .Where(r => r.FormId == id)
            .GroupBy(r => r.FormVersionId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        return Ok(new
        {
            form.Id,
            form.Title,
            form.CatalogCode,
            form.Slug,
            SelectedVersion = new
            {
                selectedVersion.Id,
                selectedVersion.VersionNumber,
                selectedVersion.PublishedAt
            },
            Versions = form.Versions
                .OrderByDescending(v => v.VersionNumber)
                .Select(v => new
                {
                    v.Id,
                    v.VersionNumber,
                    v.PublishedAt,
                    IsActive = v.Id == form.ActiveVersionId,
                    ResponseCount = countsByVersion.GetValueOrDefault(v.Id, 0)
                }),
            schema.Fields,
            Responses = responses.Select(r => new
            {
                r.Id,
                r.FormVersionId,
                r.SubmittedAt,
                Answers = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(r.AnswersJson, FormJson.Options)
                    ?? new Dictionary<string, JsonElement>()
            })
        });
    }

    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> ExportResponses(
        Guid id,
        [FromQuery] Guid? versionId,
        CancellationToken ct)
    {
        var form = await db.Forms
            .AsNoTracking()
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Id == id, ct);

        if (form is null)
            return NotFound(new { message = "Form not found." });

        if (form.Versions.Count == 0)
            return BadRequest(new { message = "Publish at least one version before exporting responses." });

        var version = versionId.HasValue
            ? form.Versions.FirstOrDefault(v => v.Id == versionId.Value)
            : form.Versions.FirstOrDefault(v => v.Id == form.ActiveVersionId)
              ?? form.Versions.OrderByDescending(v => v.VersionNumber).First();

        if (version is null)
            return NotFound(new { message = "Requested form version not found." });

        var responses = await db.FormResponses
            .AsNoTracking()
            .Where(r => r.FormId == id && r.FormVersionId == version.Id)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);

        var bytes = excelExport.BuildWorkbook(form, version, responses);
        var safeSlug = Regex.Replace(form.Slug, @"[^a-zA-Z0-9_-]+", "-");
        var fileName = $"{safeSlug}-v{version.VersionNumber}-responses.xlsx";

        return File(
            bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteForm(Guid id, CancellationToken ct)
    {
        var form = await db.Forms.FirstOrDefaultAsync(f => f.Id == id, ct);
        if (form is null) return NotFound();

        var responses = await db.FormResponses.Where(r => r.FormId == id).ToListAsync(ct);
        db.FormResponses.RemoveRange(responses);
        db.Forms.Remove(form);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
