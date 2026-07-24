import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('data', '0019_add_dashboard_config'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Add site_id with default=0 (existing rows become site 0 = legacy)
        migrations.AddField(
            model_name='dashboardconfig',
            name='site_id',
            field=models.IntegerField(default=0),
        ),
        # 2. Relax OneToOneField → ForeignKey (drops the unique constraint on user alone)
        migrations.AlterField(
            model_name='dashboardconfig',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # 3. Replace the old per-user unique with per-(user, site_id) unique
        migrations.AlterUniqueTogether(
            name='dashboardconfig',
            unique_together={('user', 'site_id')},
        ),
    ]
