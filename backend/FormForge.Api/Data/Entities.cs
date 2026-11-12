namespace FormForge.Api.Data;

public sealed class FormEntity
{
    public Guid Id { get; set; }
    public string CatalogCode { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CurrentDraftJson { get; set; } = "{\"fields\":[]}";
    public Guid? ActiveVersionId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<FormVersionEntity> Versions { get; set; } = [];
}

public sealed class FormVersionEntity
{
    public Guid Id { get; set; }
    public Guid FormId { get; set; }
    public int VersionNumber { get; set; }
    public string SchemaJson { get; set; } = "{\"fields\":[]}";
    public bool IsPublished { get; set; }
    public DateTimeOffset PublishedAt { get; set; }

    public FormEntity? Form { get; set; }
    public List<FormResponseEntity> Responses { get; set; } = [];
}

public sealed class FormResponseEntity
{
    public Guid Id { get; set; }
    public Guid FormId { get; set; }
    public Guid FormVersionId { get; set; }
    public string AnswersJson { get; set; } = "{}";
    public DateTimeOffset SubmittedAt { get; set; }

    public FormVersionEntity? FormVersion { get; set; }
}

