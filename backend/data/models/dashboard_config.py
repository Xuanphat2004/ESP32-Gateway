from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class DashboardConfig(models.Model):
    user    = models.ForeignKey(User, on_delete=models.CASCADE)
    site_id = models.IntegerField(default=0)
    widgets = models.JSONField(default=list)

    class Meta:
        db_table = 'dashboard_config'
        unique_together = [('user', 'site_id')]
