using Microsoft.EntityFrameworkCore;

namespace FormForge.Api.Data;

public sealed class FormForgeDbContext(DbContextOptions<FormForgeDbContext> options) : DbContext(options)
{
    public DbSet<FormEntity> Forms => Set<FormEntity>();
    public DbSet<FormVersionEntity> FormVersions => Set<FormVersionEntity>();
    public DbSet<FormResponseEntity> FormResponses => Set<FormResponseEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<FormEntity>(entity =>
        {
            entity.ToTable("Forms");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.CatalogCode).HasMaxLength(24).IsRequired();
            entity.Property(x => x.Slug).HasMaxLength(120).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.CurrentDraftJson).IsRequired();
            entity.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<FormVersionEntity>(entity =>
        {
            entity.ToTable("FormVersions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SchemaJson).IsRequired();
            entity.HasIndex(x => new { x.FormId, x.VersionNumber }).IsUnique();
            entity.HasOne(x => x.Form)
                .WithMany(f => f.Versions)
                .HasForeignKey(x => x.FormId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FormResponseEntity>(entity =>
        {
            entity.ToTable("FormResponses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AnswersJson).IsRequired();
            entity.HasIndex(x => new { x.FormId, x.FormVersionId, x.SubmittedAt });
            // Restrict cascade so responses stay strictly anchored to their immutable FormVersion.
            entity.HasOne(x => x.FormVersion)
                .WithMany(v => v.Responses)
                .HasForeignKey(x => x.FormVersionId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
