using System.Text.Json;
using FormForge.Api.Data;
using FormForge.Api.FieldRegistry;
using FormForge.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FormForge.Api.Controllers;

[ApiController]
[Route("api/public/forms")]
public sealed class PublicFormsController(FormForgeDbContext db, FieldRegistryService registry) : ControllerBase
{
    public sealed record SubmitResponseRequest(Dictionary<string, JsonElement> Answers);

    [HttpGet("{slug}")]
    public async Task<ActionResult<object>> GetPublicForm(string slug, CancellationToken ct)
    {
        var form = await db.Forms
            .AsNoTracking()
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Slug == slug, ct);

        if (form is null || !form.ActiveVersionId.HasValue)
            return NotFound(new { message = "Published form not found." });

        var activeVersion = form.Versions.FirstOrDefault(v => v.Id == form.ActiveVersionId.Value && v.IsPublished);
        if (activeVersion is null)
            return NotFound(new { message = "Form has no published version yet." });

        var schema = JsonSerializer.Deserialize<FormSchema>(activeVersion.SchemaJson, FormJson.Options) ?? new FormSchema();

        return Ok(new
        {
            form.Id,
            form.CatalogCode,
            form.Slug,
            form.Title,
            form.Description,
            VersionId = activeVersion.Id,
            activeVersion.VersionNumber,
            activeVersion.PublishedAt,
            Schema = schema
        });
    }

    [HttpPost("{slug}/responses")]
    public async Task<ActionResult<object>> SubmitResponse(
        string slug,
        [FromBody] SubmitResponseRequest request,
        CancellationToken ct)
    {
        var form = await db.Forms
            .AsNoTracking()
            .Include(f => f.Versions)
            .FirstOrDefaultAsync(f => f.Slug == slug, ct);

        if (form is null || !form.ActiveVersionId.HasValue)
            return NotFound(new { message = "Published form not found." });

        var activeVersion = form.Versions.FirstOrDefault(v => v.Id == form.ActiveVersionId.Value && v.IsPublished);
        if (activeVersion is null)
            return NotFound(new { message = "Form is not accepting submissions yet." });

        var schema = JsonSerializer.Deserialize<FormSchema>(activeVersion.SchemaJson, FormJson.Options) ?? new FormSchema();
        var (isValid, normalizedAnswers, errors) = registry.ValidateSubmission(
            schema,
            request.Answers ?? new Dictionary<string, JsonElement>());

        if (!isValid)
        {
            return BadRequest(new
            {
                message = "Please correct the highlighted fields.",
                errors
            });
        }

        var response = new FormResponseEntity
        {
            Id = Guid.NewGuid(),
            FormId = form.Id,
            FormVersionId = activeVersion.Id,
            AnswersJson = JsonSerializer.Serialize(normalizedAnswers, FormJson.Options),
            SubmittedAt = DateTimeOffset.UtcNow
        };

        db.FormResponses.Add(response);
        await db.SaveChangesAsync(ct);

        return Created(
            $"/api/forms/{form.Id}/responses?versionId={activeVersion.Id}",
            new
            {
                responseId = response.Id,
                versionId = activeVersion.Id,
                versionNumber = activeVersion.VersionNumber,
                submittedAt = response.SubmittedAt
            });
    }
}
