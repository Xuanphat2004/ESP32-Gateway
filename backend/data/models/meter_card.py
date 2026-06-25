from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class MeterCardConfig(models.Model):
    user     = models.ForeignKey(User, on_delete=models.CASCADE)
    meter_id = models.IntegerField()
    params   = models.JSONField(default=list)  # ["Grid-Frequency", "Phase-A-Voltage-L1-N", ...]

    class Meta:
        db_table        = 'meter_card_config'
        unique_together = ('user', 'meter_id')
